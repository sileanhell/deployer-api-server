import type { BunFile } from "bun";
import {
  Flag,
  HostOS,
  MSDOS_DIRECTORY_ATTR,
  Signature,
  Size,
  UnixMode,
  ZIP64_EXTRA_ID,
  ZIP64_MARKER_16,
  ZIP64_MARKER_32,
} from "./format";
import { ByteReader, readRange } from "./reader";

export type EntryKind = "file" | "directory" | "symlink";

/** Запись центрального каталога — всё, что нужно для распаковки файла. */
export interface ZipEntry {
  /** Имя как в архиве (разделитель может быть и `\`). */
  name: string;
  kind: EntryKind;
  method: number;
  flags: number;
  crc32: number;
  compressedSize: number;
  size: number;
  localHeaderOffset: number;
  /** Unix-права (0o755 и т.п.), если архив создан на unix. */
  permissions: number | null;
}

interface DirectoryLocation {
  offset: number;
  size: number;
  entries: number;
}

const decoder = new TextDecoder();

/** Ищет End Of Central Directory с конца файла (после него может быть комментарий до 64 КБ). */
async function findEndOfCentralDirectory(file: BunFile): Promise<{ offset: number; record: ByteReader }> {
  const tailStart = Math.max(0, file.size - Size.END_OF_CENTRAL_DIR - Size.MAX_COMMENT);
  const tail = await readRange(file, tailStart, file.size);
  for (let i = tail.length - Size.END_OF_CENTRAL_DIR; i >= 0; i--) {
    if (tail.u32(i) === Signature.END_OF_CENTRAL_DIR) {
      return { offset: tailStart + i, record: await readRange(file, tailStart + i, tailStart + i + Size.END_OF_CENTRAL_DIR) };
    }
  }
  throw new Error("ZIP: не найден центральный каталог (архив повреждён или обрезан)");
}

/** ZIP64: настоящие размеры каталога лежат в отдельной записи, на которую указывает локатор. */
async function readZip64Location(file: BunFile, eocdOffset: number): Promise<DirectoryLocation> {
  const locator = await readRange(file, eocdOffset - Size.ZIP64_LOCATOR, eocdOffset);
  if (locator.u32(0) !== Signature.ZIP64_LOCATOR) throw new Error("ZIP64: не найден локатор");
  const recordOffset = locator.u64(8);
  const record = await readRange(file, recordOffset, recordOffset + Size.ZIP64_END_OF_CENTRAL_DIR);
  if (record.u32(0) !== Signature.ZIP64_END_OF_CENTRAL_DIR) throw new Error("ZIP64: повреждена запись конца каталога");
  return { entries: record.u64(32), size: record.u64(40), offset: record.u64(48) };
}

async function locateDirectory(file: BunFile): Promise<DirectoryLocation> {
  const { offset, record } = await findEndOfCentralDirectory(file);
  const location = { entries: record.u16(10), size: record.u32(12), offset: record.u32(16) };
  const isZip64 =
    location.entries === ZIP64_MARKER_16 || location.size === ZIP64_MARKER_32 || location.offset === ZIP64_MARKER_32;
  if (record.u16(4) !== 0 || record.u16(6) !== 0) throw new Error("ZIP: многотомные архивы не поддерживаются");
  return isZip64 ? readZip64Location(file, offset) : location;
}

/** Значения из ZIP64 extra идут только для полей, равных 0xFFFFFFFF, в фиксированном порядке. */
function applyZip64Extra(extra: ByteReader, entry: Pick<ZipEntry, "size" | "compressedSize" | "localHeaderOffset">): void {
  for (let i = 0; i + 4 <= extra.length; ) {
    const id = extra.u16(i);
    const size = extra.u16(i + 2);
    if (id === ZIP64_EXTRA_ID) {
      let p = i + 4;
      const next = () => {
        const value = extra.u64(p);
        p += 8;
        return value;
      };
      if (entry.size === ZIP64_MARKER_32) entry.size = next();
      if (entry.compressedSize === ZIP64_MARKER_32) entry.compressedSize = next();
      if (entry.localHeaderOffset === ZIP64_MARKER_32) entry.localHeaderOffset = next();
      return;
    }
    i += 4 + size;
  }
}

function entryKind(name: string, host: number, externalAttrs: number): { kind: EntryKind; permissions: number | null } {
  if (host === HostOS.UNIX) {
    const mode = externalAttrs >>> 16;
    const type = mode & UnixMode.TYPE_MASK;
    const permissions = mode & UnixMode.PERMISSIONS || null;
    if (type === UnixMode.SYMLINK) return { kind: "symlink", permissions };
    if (type === UnixMode.DIRECTORY || name.endsWith("/")) return { kind: "directory", permissions };
    return { kind: "file", permissions };
  }
  const isDir = name.endsWith("/") || name.endsWith("\\") || (externalAttrs & MSDOS_DIRECTORY_ATTR) !== 0;
  return { kind: isDir ? "directory" : "file", permissions: null };
}

function parseEntry(dir: ByteReader, at: number): { entry: ZipEntry; next: number } {
  if (dir.u32(at) !== Signature.CENTRAL_FILE) throw new Error("ZIP: повреждён центральный каталог");
  const nameLength = dir.u16(at + 28);
  const extraLength = dir.u16(at + 30);
  const commentLength = dir.u16(at + 32);
  const nameStart = at + Size.CENTRAL_FILE_HEADER;
  const name = decoder.decode(dir.slice(nameStart, nameStart + nameLength));
  const host = dir.u16(at + 4) >> 8;

  const entry: ZipEntry = {
    name,
    ...entryKind(name, host, dir.u32(at + 38)),
    flags: dir.u16(at + 8),
    method: dir.u16(at + 10),
    crc32: dir.u32(at + 16),
    compressedSize: dir.u32(at + 20),
    size: dir.u32(at + 24),
    localHeaderOffset: dir.u32(at + 42),
  };
  const extraStart = nameStart + nameLength;
  applyZip64Extra(new ByteReader(dir.slice(extraStart, extraStart + extraLength)), entry);

  return { entry, next: extraStart + extraLength + commentLength };
}

/** Читает список файлов архива из центрального каталога. */
export async function readCentralDirectory(file: BunFile): Promise<ZipEntry[]> {
  const location = await locateDirectory(file);
  const dir = await readRange(file, location.offset, location.offset + location.size);
  const entries: ZipEntry[] = [];
  for (let at = 0, i = 0; i < location.entries; i++) {
    const { entry, next } = parseEntry(dir, at);
    entries.push(entry);
    at = next;
  }
  return entries;
}

export const isEncrypted = (entry: ZipEntry) => (entry.flags & Flag.ENCRYPTED) !== 0;
