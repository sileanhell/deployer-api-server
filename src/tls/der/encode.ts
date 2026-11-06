/** Минимальный DER-энкодер (ITU-T X.690) — ровно то, что нужно для X.509-сертификата. */

export const Tag = {
  BOOLEAN: 0x01,
  INTEGER: 0x02,
  BIT_STRING: 0x03,
  OCTET_STRING: 0x04,
  OID: 0x06,
  UTF8_STRING: 0x0c,
  UTC_TIME: 0x17,
  GENERALIZED_TIME: 0x18,
  SEQUENCE: 0x30,
  SET: 0x31,
  /** [n] IMPLICIT, примитивный (например, iPAddress в SAN — [7] = 0x87). */
  contextPrimitive: (n: number) => 0x80 | n,
  /** [n] EXPLICIT, составной. */
  contextConstructed: (n: number) => 0xa0 | n,
} as const;

function length(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let v = n; v > 0; v >>= 8) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

export function tlv(tag: number, ...content: Buffer[]): Buffer {
  const body = Buffer.concat(content);
  return Buffer.concat([Buffer.from([tag]), length(body.length), body]);
}

export const sequence = (...items: Buffer[]) => tlv(Tag.SEQUENCE, ...items);
export const set = (...items: Buffer[]) => tlv(Tag.SET, ...items);
export const octetString = (b: Buffer) => tlv(Tag.OCTET_STRING, b);
export const bitString = (b: Buffer) => tlv(Tag.BIT_STRING, Buffer.from([0]), b); // 0 неиспользуемых бит
export const utf8String = (s: string) => tlv(Tag.UTF8_STRING, Buffer.from(s, "utf8"));
export const boolean = (v: boolean) => tlv(Tag.BOOLEAN, Buffer.from([v ? 0xff : 0]));
export const explicit = (n: number, inner: Buffer) => tlv(Tag.contextConstructed(n), inner);

/** Неотрицательное INTEGER из big-endian байтов, в минимальной форме. */
export function integer(bytes: Uint8Array): Buffer {
  let b = Buffer.from(bytes);
  let i = 0;
  while (i < b.length - 1 && b[i] === 0 && !(b[i + 1]! & 0x80)) i++;
  b = b.subarray(i);
  if (b[0]! & 0x80) b = Buffer.concat([Buffer.from([0]), b]); // старший бит = знак → дописываем 0
  return tlv(Tag.INTEGER, b);
}

export function oid(dotted: string): Buffer {
  const parts = dotted.split(".").map(Number);
  const out = [40 * parts[0]! + parts[1]!];
  for (const n of parts.slice(2)) {
    const chunk = [n & 0x7f];
    for (let v = n >>> 7; v > 0; v >>>= 7) chunk.unshift((v & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return tlv(Tag.OID, Buffer.from(out));
}

/** RFC 5280: до 2049 года — UTCTime, дальше — GeneralizedTime. */
export function time(date: Date): Buffer {
  const full = date.toISOString().replace(/[-:T]/g, "").slice(0, 14) + "Z"; // YYYYMMDDHHMMSSZ
  return date.getUTCFullYear() < 2050
    ? tlv(Tag.UTC_TIME, Buffer.from(full.slice(2)))
    : tlv(Tag.GENERALIZED_TIME, Buffer.from(full));
}
