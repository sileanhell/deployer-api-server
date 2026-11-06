/** Константы формата ZIP (PKWARE APPNOTE 6.3). */

export const Signature = {
  LOCAL_FILE: 0x04034b50,
  CENTRAL_FILE: 0x02014b50,
  END_OF_CENTRAL_DIR: 0x06054b50,
  ZIP64_END_OF_CENTRAL_DIR: 0x06064b50,
  ZIP64_LOCATOR: 0x07064b50,
} as const;

export const Method = {
  STORED: 0,
  DEFLATE: 8,
} as const;

/** Названия частых неподдерживаемых методов — для понятной ошибки. */
export const UNSUPPORTED_METHODS: Record<number, string> = {
  9: "Deflate64",
  12: "BZIP2",
  14: "LZMA",
  93: "Zstandard",
  95: "XZ",
  99: "AES",
};

export const Flag = {
  ENCRYPTED: 1 << 0,
  UTF8: 1 << 11,
} as const;

/** Поле равно этому значению — настоящее значение лежит в ZIP64 extra. */
export const ZIP64_MARKER_16 = 0xffff;
export const ZIP64_MARKER_32 = 0xffffffff;
export const ZIP64_EXTRA_ID = 0x0001;

/** Старший байт "version made by": ОС, создавшая архив. */
export const HostOS = {
  MSDOS: 0,
  UNIX: 3,
} as const;

export const MSDOS_DIRECTORY_ATTR = 0x10;

/** Типы файлов в unix-режиме (st_mode). */
export const UnixMode = {
  TYPE_MASK: 0o170000,
  DIRECTORY: 0o040000,
  SYMLINK: 0o120000,
  PERMISSIONS: 0o7777,
} as const;

/** Размеры фиксированных частей записей. */
export const Size = {
  END_OF_CENTRAL_DIR: 22,
  ZIP64_LOCATOR: 20,
  ZIP64_END_OF_CENTRAL_DIR: 56,
  CENTRAL_FILE_HEADER: 46,
  LOCAL_FILE_HEADER: 30,
  MAX_COMMENT: 0xffff,
} as const;
