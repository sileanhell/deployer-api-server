import type { BunFile } from "bun";

/** Чтение little-endian полей из куска архива. */
export class ByteReader {
  private readonly view: DataView;

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get length(): number {
    return this.bytes.length;
  }

  u16(offset: number): number {
    return this.view.getUint16(offset, true);
  }

  u32(offset: number): number {
    return this.view.getUint32(offset, true);
  }

  /** 64-битное поле как number; больше 2^53 в реальных архивах не бывает. */
  u64(offset: number): number {
    const value = this.view.getBigUint64(offset, true);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ZIP: слишком большое 64-битное значение");
    return Number(value);
  }

  slice(start: number, end: number): Uint8Array {
    return this.bytes.subarray(start, end);
  }
}

/** Читает байты [start, end) файла архива, не загружая его целиком. */
export async function readRange(file: BunFile, start: number, end: number): Promise<ByteReader> {
  if (start < 0 || end > file.size || start > end) throw new Error("ZIP: повреждённый архив (смещение за пределами файла)");
  return new ByteReader(await file.slice(start, end).bytes());
}
