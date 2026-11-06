import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

/** Есть ли файл или каталог (`Bun.file().exists()` видит только файлы, `stat()` — и каталоги). */
export function pathExists(path: string): Promise<boolean> {
  return Bun.file(path).stat().then(
    () => true,
    () => false,
  );
}

/** Временный каталог в системном TEMP (Linux: /tmp или $TMPDIR, Windows: %TEMP%). */
export function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/** Рекурсивное удаление без исключений (для уборки временных файлов). */
export async function removeQuietly(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true }).catch(() => {});
}

/** Путь abs относительно root с разделителем `/` на любой ОС. */
export function toPosixRelative(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}
