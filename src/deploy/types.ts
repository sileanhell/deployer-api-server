import type { KeepMatcher } from "../files/keep-matcher";

export type StepName = "queue" | "verify" | "extract" | "stop" | "clean" | "install" | "start" | "recover";

/** Событие прогресса: уходит в лог сервера и клиенту. */
export type Emit = (step: StepName, message: string) => void;

export interface DeployTarget {
  /** Имя сервиса из X-Service-Name; пусто — управление сервисом пропускается. */
  service: string;
  /** Абсолютный путь из X-Deploy-Dir. */
  deployDir: string;
}

export interface DeployJob extends DeployTarget {
  id: string;
  archivePath: string;
  keep: KeepMatcher;
}
