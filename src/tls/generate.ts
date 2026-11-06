/**
 * Генерация самоподписного X.509 v3 сертификата без openssl и зависимостей:
 * ключ ECDSA P-256 и подпись — WebCrypto (crypto.subtle), структура — свой DER-энкодер.
 */
import {
  bitString,
  boolean,
  explicit,
  integer,
  octetString,
  oid,
  sequence,
  set,
  Tag,
  time,
  tlv,
  utf8String,
} from "./der/encode";
import { OID } from "./der/oids";
import { ipToBytes } from "./ip";
import { toPem } from "./pem";

export interface KeyPairPem {
  cert: string;
  key: string;
}

const ECDSA_P256 = { name: "ECDSA", namedCurve: "P-256" } as const;
const ECDSA_SHA256 = { name: "ECDSA", hash: "SHA-256" } as const;
const CLOCK_SKEW_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

const extension = (id: string, critical: boolean, value: Buffer) =>
  sequence(oid(id), ...(critical ? [boolean(true)] : []), octetString(value));

function extensions(ips: string[]): Buffer {
  const san = sequence(...ips.map((ip) => tlv(Tag.contextPrimitive(7), ipToBytes(ip)))); // [7] iPAddress
  return sequence(
    extension(OID.basicConstraints, true, sequence()), // CA:FALSE
    extension(OID.keyUsage, true, tlv(Tag.BIT_STRING, Buffer.from([0x07, 0x80]))), // digitalSignature
    extension(OID.extKeyUsage, false, sequence(oid(OID.serverAuth))),
    extension(OID.subjectAltName, false, san),
  );
}

function serialNumber(): Uint8Array {
  const serial = crypto.getRandomValues(new Uint8Array(16));
  serial[0]! &= 0x7f; // положительное число
  return serial;
}

/** WebCrypto отдаёт подпись ECDSA как r||s (64 байта), X.509 требует DER SEQUENCE { INTEGER r, INTEGER s }. */
const ecdsaSignatureToDer = (raw: Uint8Array) => sequence(integer(raw.subarray(0, 32)), integer(raw.subarray(32)));

/** Самоподписной серверный сертификат на указанные IP (первый — CN). */
export async function generateSelfSigned(ips: string[], days: number): Promise<KeyPairPem> {
  const { privateKey, publicKey } = (await crypto.subtle.generateKey(ECDSA_P256, true, ["sign", "verify"])) as CryptoKeyPair;

  const algorithm = sequence(oid(OID.ecdsaWithSha256));
  const name = sequence(set(sequence(oid(OID.commonName), utf8String(ips[0]!))));
  const now = Date.now();

  const tbs = sequence(
    explicit(0, integer(Uint8Array.of(2))), // version v3
    integer(serialNumber()),
    algorithm,
    name, // issuer
    sequence(time(new Date(now - CLOCK_SKEW_MS)), time(new Date(now + days * DAY_MS))),
    name, // subject = issuer → самоподписной
    Buffer.from(await crypto.subtle.exportKey("spki", publicKey)),
    explicit(3, extensions(ips)),
  );

  const signature = new Uint8Array(await crypto.subtle.sign(ECDSA_SHA256, privateKey, new Uint8Array(tbs)));
  const certificate = sequence(tbs, algorithm, bitString(ecdsaSignatureToDer(signature)));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey));

  return { cert: toPem("CERTIFICATE", certificate), key: toPem("PRIVATE KEY", pkcs8) };
}
