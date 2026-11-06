import type { BunFile } from "bun";
import { chmod, mkdir, rm, symlink } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { readCentralDirectory, type ZipEntry } from "./central-directory";
import { openEntryStream, pumpVerified, readEntryText } from "./entry-data";
import { safeEntryPath } from "./entry-path";

export interface ExtractResult {
  files: number;
  directories: number;
  symlinks: number;
}

const DEFAULT_DIR_MODE = 0o755;
const canChmod = process.platform !== "win32";

async function applyPermissions(path: string, permissions: number | null): Promise<void> {
  if (canChmod && permissions) await chmod(path, permissions);
}

async function writeFile(file: BunFile, entry: ZipEntry, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await rm(path, { recursive: true, force: true }); // запись могла повториться в архиве
  const writer = Bun.file(path).writer();
  try {
    await pumpVerified(entry, await openEntryStream(file, entry), async (chunk) => {
      writer.write(chunk);
      await writer.flush(); // на диск по мере распаковки — память не растёт
    });
  } finally {
    await writer.end();
  }
  await applyPermissions(path, entry.permissions);
}

async function writeSymlink(file: BunFile, entry: ZipEntry, path: string, dest: string): Promise<void> {
  const target = await readEntryText(file, entry);
  const real = isAbsolute(target) ? resolve(target) : resolve(dirname(path), target);
  const base = resolve(dest);
  if (real !== base && !real.startsWith(base + sep)) {
    throw new Error(`ZIP: симлинк ${entry.name} указывает за пределы архива: ${target}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await rm(path, { recursive: true, force: true });
  await symlink(target, path);
}

/**
 * Распаковывает ZIP в dest средствами Bun, без внешних утилит.
 * Поддерживает stored и deflate, ZIP64 (файлы > 4 ГБ), unix-права и симлинки;
 * проверяет CRC32 и размер каждого файла. Симлинки создаются в самом конце,
 * чтобы ни один файл архива не мог быть записан «через» симлинк наружу.
 */
export async function extractZip(archive: string, dest: string): Promise<ExtractResult> {
  const file = Bun.file(archive);
  const entries = await readCentralDirectory(file);
  await mkdir(dest, { recursive: true });
  const result: ExtractResult = { files: 0, directories: 0, symlinks: 0 };
  const directories: { path: string; entry: ZipEntry }[] = [];
  const symlinks: { path: string; entry: ZipEntry }[] = [];

  for (const entry of entries) {
    const target = safeEntryPath(dest, entry.name);
    if (!target) continue;

    if (entry.kind === "directory") {
      await mkdir(target.abs, { recursive: true });
      directories.push({ path: target.abs, entry });
    } else if (entry.kind === "symlink") {
      symlinks.push({ path: target.abs, entry });
    } else {
      await writeFile(file, entry, target.abs);
      result.files++;
    }
  }

  for (const { path, entry } of symlinks) {
    await writeSymlink(file, entry, path, dest);
    result.symlinks++;
  }
  // права каталогов — последними: каталог без +w не помешает записать в него файлы
  for (const { path, entry } of directories) {
    await applyPermissions(path, entry.permissions ?? DEFAULT_DIR_MODE);
    result.directories++;
  }
  return result;
}
