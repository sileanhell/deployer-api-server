export function toPem(label: string, der: Uint8Array): string {
  const base64 = Buffer.from(der).toString("base64").match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----\n`;
}

export function fromPem(pem: string): Buffer {
  return Buffer.from(pem.replace(/-----[^-]+-----|\s+/g, ""), "base64");
}

/** SHA-256 отпечаток в привычном виде AA:BB:CC:... */
export function fingerprint(der: Uint8Array): string {
  const hex = new Bun.CryptoHasher("sha256").update(der).digest("hex").toUpperCase();
  return hex.match(/../g)!.join(":");
}
