import { lstat, readdir, readlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { toPosixRelative } from "../shared/fs";

const isInside = (base: string, path: string) => path === base || path.startsWith(base + sep);

/**
 * Проверяет распакованное дерево: никакие пути и симлинки не ведут за пределы root (zip-slip).
 * @returns количество файлов (включая симлинки)
 */
export async function assertTreeInside(root: string): Promise<number> {
  const base = resolve(root);
  return countInside(base, base);
}

async function countInside(base: string, dir: string): Promise<number> {
  let count = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (!resolve(abs).startsWith(base + sep)) throw new Error(`путь вне архива: ${abs}`);

    const stat = await lstat(abs);
    if (stat.isSymbolicLink()) {
      await assertLinkInside(base, abs);
      count++;
    } else if (stat.isDirectory()) {
      count += await countInside(base, abs);
    } else {
      count++;
    }
  }
  return count;
}

async function assertLinkInside(base: string, link: string): Promise<void> {
  const target = await readlink(link);
  const real = isAbsolute(target) ? resolve(target) : resolve(dirname(link), target);
  if (!isInside(base, real)) {
    throw new Error(`симлинк ${toPosixRelative(base, link)} указывает за пределы архива: ${target}`);
  }
}
