import type { BunFile } from "bun";
import { isEncrypted, type ZipEntry } from "./central-directory";
import { Method, Signature, Size, UNSUPPORTED_METHODS } from "./format";
import { readRange } from "./reader";

/** Смещение сжатых данных: после локального заголовка, длина имени и extra в нём может отличаться от центрального. */
async function dataOffset(file: BunFile, entry: ZipEntry): Promise<number> {
  const header = await readRange(file, entry.localHeaderOffset, entry.localHeaderOffset + Size.LOCAL_FILE_HEADER);
  if (header.u32(0) !== Signature.LOCAL_FILE) throw new Error(`ZIP: повреждён локальный заголовок ${entry.name}`);
  return entry.localHeaderOffset + Size.LOCAL_FILE_HEADER + header.u16(26) + header.u16(28);
}

function assertSupported(entry: ZipEntry): void {
  if (isEncrypted(entry)) throw new Error(`ZIP: зашифрованные архивы не поддерживаются (${entry.name})`);
  if (entry.method !== Method.STORED && entry.method !== Method.DEFLATE) {
    const name = UNSUPPORTED_METHODS[entry.method] ?? `метод ${entry.method}`;
    throw new Error(`ZIP: сжатие ${name} не поддерживается (${entry.name}), используйте Deflate`);
  }
}

/** Поток распакованных данных записи (stored или deflate). */
export async function openEntryStream(file: BunFile, entry: ZipEntry): Promise<ReadableStream<Uint8Array>> {
  assertSupported(entry);
  const start = await dataOffset(file, entry);
  const end = start + entry.compressedSize;
  if (end > file.size) throw new Error(`ZIP: данные ${entry.name} выходят за конец архива`);

  const raw = file.slice(start, end).stream();
  return entry.method === Method.DEFLATE ? raw.pipeThrough(new DecompressionStream("deflate-raw")) : raw;
}

/**
 * Пропускает поток через sink, по дороге проверяя размер и CRC32 с указанными в архиве.
 * Защищает и от повреждённых данных, и от «zip-бомб», врущих о размере.
 */
export async function pumpVerified(
  entry: ZipEntry,
  stream: ReadableStream<Uint8Array>,
  sink: (chunk: Uint8Array) => void | Promise<void>,
): Promise<void> {
  let crc = 0;
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > entry.size) throw new Error(`ZIP: ${entry.name} больше заявленного размера`);
    crc = Bun.hash.crc32(chunk, crc);
    await sink(chunk);
  }
  if (size !== entry.size) throw new Error(`ZIP: ${entry.name} — размер ${size} вместо ${entry.size}`);
  if (crc >>> 0 !== entry.crc32 >>> 0) throw new Error(`ZIP: ${entry.name} — неверная контрольная сумма (архив повреждён)`);
}

/** Вся запись в память — для небольших данных (цель симлинка). */
export async function readEntryText(file: BunFile, entry: ZipEntry): Promise<string> {
  const parts: Uint8Array[] = [];
  await pumpVerified(entry, await openEntryStream(file, entry), (c) => void parts.push(c));
  return Buffer.concat(parts).toString("utf8");
}
