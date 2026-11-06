import { sep } from "node:path";
import type { DeployTarget } from "./types";

/**
 * Очередь деплоев. Разные деплои идут параллельно, кроме конфликтующих:
 *  - один и тот же сервис (X-Service-Name);
 *  - пересекающиеся каталоги (одинаковые или один внутри другого).
 * Конфликтующий деплой не отклоняется, а ждёт своей очереди (FIFO, без обгона).
 */

export interface QueueEntry extends DeployTarget {
  id: string;
}

interface Waiter extends QueueEntry {
  wake?: () => void;
}

export interface QueueSnapshot {
  active: QueueView[];
  queued: QueueView[];
}

interface QueueView {
  id: string;
  service: string | null;
  deployDir: string;
}

/** Освобождает место в очереди; повторный вызов ничего не делает. */
export type Release = () => void;

const normalizeDir = (path: string) => {
  const withSep = path.endsWith(sep) ? path : path + sep;
  return process.platform === "win32" ? withSep.toLowerCase() : withSep;
};

function conflictReason(a: DeployTarget, b: DeployTarget): string | null {
  if (a.service && a.service === b.service) return `сервис ${a.service}`;
  const da = normalizeDir(a.deployDir);
  const db = normalizeDir(b.deployDir);
  if (da.startsWith(db) || db.startsWith(da)) return `каталог ${b.deployDir}`;
  return null;
}

export class DeployQueue {
  private readonly active: Waiter[] = [];
  private readonly waiting: Waiter[] = [];

  /** Ждёт, пока цель освободится; onWait вызывается, если пришлось ждать. */
  async acquire(entry: QueueEntry, onWait: (message: string) => void): Promise<Release> {
    const waiter: Waiter = { ...entry };
    this.waiting.push(waiter);

    const blocker = this.blockerOf(waiter);
    if (blocker) {
      onWait(`жду завершения деплоя ${blocker.id} (общий ${blocker.reason})`);
      await new Promise<void>((resolve) => {
        waiter.wake = resolve;
        this.pump();
      });
    } else {
      this.pump();
    }
    return this.releaser(waiter);
  }

  snapshot(): QueueSnapshot {
    const view = ({ id, service, deployDir }: Waiter): QueueView => ({ id, service: service || null, deployDir });
    return { active: this.active.map(view), queued: this.waiting.map(view) };
  }

  private releaser(waiter: Waiter): Release {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const index = this.active.indexOf(waiter);
      if (index >= 0) this.active.splice(index, 1);
      this.pump();
    };
  }

  /** С кем конфликтует waiter: с активными и с теми, кто встал в очередь раньше. */
  private blockerOf(waiter: Waiter): { id: string; reason: string } | null {
    const ahead = this.waiting.slice(0, this.waiting.indexOf(waiter));
    for (const other of [...this.active, ...ahead]) {
      const reason = conflictReason(waiter, other);
      if (reason) return { id: other.id, reason };
    }
    return null;
  }

  /** Запускает всех ожидающих, кому больше ничего не мешает. */
  private pump(): void {
    for (const waiter of [...this.waiting]) {
      if (this.blockerOf(waiter)) continue;
      this.waiting.splice(this.waiting.indexOf(waiter), 1);
      this.active.push(waiter);
      waiter.wake?.();
    }
  }
}

/** Общая очередь сервера. */
export const deployQueue = new DeployQueue();
