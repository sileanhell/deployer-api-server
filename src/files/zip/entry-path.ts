import { join, resolve, sep } from "node:path";

/**
 * Безопасный путь записи архива внутри dest (защита от zip-slip).
 * `\` считается разделителем (архивы из Windows), абсолютные пути, буквы дисков и `..` запрещены.
 * @returns абсолютный путь или null для пустого имени (запись корня)
 */
export function safeEntryPath(dest: string, name: string): { abs: string; rel: string } | null {
  const rel = name.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!rel) return null;

  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) throw new Error(`ZIP: абсолютный путь в архиве: ${name}`);
  const segments = rel.split("/");
  if (segments.some((s) => s === "..")) throw new Error(`ZIP: путь с ".." в архиве: ${name}`);
  if (segments.some((s) => s.includes("\0"))) throw new Error(`ZIP: недопустимое имя в архиве: ${name}`);

  const base = resolve(dest);
  const abs = resolve(join(base, ...segments.filter((s) => s && s !== ".")));
  if (!abs.startsWith(base + sep)) throw new Error(`ZIP: путь вне каталога распаковки: ${name}`);
  return { abs, rel: segments.filter((s) => s && s !== ".").join("/") };
}
