import { decode, decodeOid, decodeTime, type DerNode } from "./der/decode";
import { Tag } from "./der/encode";
import { OID } from "./der/oids";
import { bytesToIp } from "./ip";

export interface CertificateInfo {
  notAfter: Date;
  /** IP из SAN в читаемом виде. */
  ips: string[];
  /** Те же IP как hex байтов — для сравнения (см. ipKey). */
  ipKeys: Set<string>;
}

function tbsFields(der: Buffer): DerNode[] {
  const certificate = decode(der)[0]!;
  return certificate.children![0]!.children!;
}

function sanIpNodes(tbs: DerNode[]): Buffer[] {
  const extensions = tbs.find((n) => n.tag === Tag.contextConstructed(3))?.children?.[0]?.children ?? [];
  for (const ext of extensions) {
    const [id, ...rest] = ext.children!;
    if (decodeOid(id!.body) !== OID.subjectAltName) continue;
    const names = decode(rest.at(-1)!.body)[0]!.children!; // значение — OCTET STRING с SEQUENCE внутри
    return names.filter((n) => n.tag === Tag.contextPrimitive(7)).map((n) => n.body);
  }
  return [];
}

/** Срок действия и IP-адреса сертификата (DER). */
export function inspectCertificate(der: Buffer): CertificateInfo {
  const tbs = tbsFields(der);
  const offset = tbs[0]!.tag === Tag.contextConstructed(0) ? 1 : 0; // version [0] необязателен
  const validity = tbs[offset + 3]!.children!;
  const ipBytes = sanIpNodes(tbs);
  return {
    notAfter: decodeTime(validity[1]!),
    ips: ipBytes.map(bytesToIp),
    ipKeys: new Set(ipBytes.map((b) => b.toString("hex"))),
  };
}
