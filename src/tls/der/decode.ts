import { Tag } from "./encode";

/** Узел DER-дерева. children есть только у составных типов (SEQUENCE, SET, [n] EXPLICIT). */
export interface DerNode {
  tag: number;
  body: Buffer;
  children?: DerNode[];
}

const CONSTRUCTED_BIT = 0x20;

export function decode(buf: Buffer, offset = 0, end = buf.length): DerNode[] {
  const nodes: DerNode[] = [];
  let off = offset;
  while (off < end) {
    const tag = buf[off++]!;
    let len = buf[off++]!;
    if (len & 0x80) {
      const count = len & 0x7f;
      len = 0;
      for (let i = 0; i < count; i++) len = len * 256 + buf[off++]!;
    }
    const body = buf.subarray(off, off + len);
    const children = tag & CONSTRUCTED_BIT ? decode(buf, off, off + len) : undefined;
    nodes.push({ tag, body, children });
    off += len;
  }
  return nodes;
}

export function decodeOid(body: Buffer): string {
  const parts = [Math.floor(body[0]! / 40), body[0]! % 40];
  let value = 0;
  for (const byte of body.subarray(1)) {
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) {
      parts.push(value);
      value = 0;
    }
  }
  return parts.join(".");
}

/** UTCTime (YYMMDDHHMMSSZ) или GeneralizedTime (YYYYMMDDHHMMSSZ). */
export function decodeTime(node: DerNode): Date {
  let s = node.body.toString("ascii");
  if (node.tag === Tag.UTC_TIME) s = (Number(s.slice(0, 2)) >= 50 ? "19" : "20") + s;
  return new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`);
}
