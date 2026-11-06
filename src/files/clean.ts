import { mkdir, readdir, rm, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { toPosixRelative } from "../shared/fs";
import type { KeepMatcher } from "./keep-matcher";

export interface CleanResult {
  removed: string[];
  kept: string[];
}

/** Удаляет всё из root, кроме совпадающего с keep. Каталог создаётся, если его нет. */
export async function cleanDirectory(root: string, keep: KeepMatcher): Promise<CleanResult> {
  const result: CleanResult = { removed: [], kept: [] };
  await mkdir(root, { recursive: true });
  await cleanLevel(root, root, keep, result);
  return result;
}

/** Чистит один уровень дерева. @returns true, если каталог стал пустым. */
async function cleanLevel(root: string, dir: string, keep: KeepMatcher, result: CleanResult): Promise<boolean> {
  let empty = true;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = toPosixRelative(root, abs);

    if (keep.matches(rel)) {
      result.kept.push(rel);
      empty = false;
    } else if (entry.isDirectory() && keep.mayContainKept(rel)) {
      // внутри может быть сохраняемое — спускаемся, а не удаляем целиком
      if (await cleanLevel(root, abs, keep, result)) {
        await rmdir(abs);
        result.removed.push(`${rel}/`);
      } else {
        empty = false;
      }
    } else {
      await rm(abs, { recursive: true, force: true });
      result.removed.push(entry.isDirectory() ? `${rel}/` : rel);
    }
  }
  return empty;
}
