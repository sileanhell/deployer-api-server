import { cp } from "node:fs/promises";
import { toPosixRelative } from "../shared/fs";

/**
 * Копирует новые файлы из src в dst. Файлы, которые были сохранены при очистке (keptExisting),
 * не перезаписываются — например, рабочий .env остаётся прежним.
 * @returns список пропущенных путей
 */
export async function installFiles(src: string, dst: string, keptExisting: Set<string>): Promise<string[]> {
  const skipped: string[] = [];
  await cp(src, dst, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
    filter: (path) => {
      const rel = toPosixRelative(src, path);
      if (rel && keptExisting.has(rel)) {
        skipped.push(rel);
        return false;
      }
      return true;
    },
  });
  return skipped;
}
