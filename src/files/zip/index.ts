/** Работа с ZIP полностью на Bun: без unzip и других внешних утилит. */
export { extractZip, type ExtractResult } from "./extract";

/** Сигнатура ZIP: PK\x03\x04 — обычный архив, PK\x05\x06 — пустой. */
export async function isZip(path: string): Promise<boolean> {
  const b = await Bun.file(path).slice(0, 4).bytes(); // читаются только первые 4 байта
  return b[0] === 0x50 && b[1] === 0x4b && ((b[2] === 3 && b[3] === 4) || (b[2] === 5 && b[3] === 6));
}
