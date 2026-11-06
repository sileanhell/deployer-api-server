import { isIP } from "node:net";
import { networkInterfaces } from "node:os";

/** IP в байты: 4 для IPv4, 16 для IPv6 (с раскрытием `::`). */
export function ipToBytes(ip: string): Buffer {
  if (isIP(ip) === 4) return Buffer.from(ip.split(".").map(Number));
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...h, ...Array<string>(8 - h.length - t.length).fill("0"), ...t] : h;
  const out = Buffer.alloc(16);
  groups.forEach((g, i) => out.writeUInt16BE(parseInt(g, 16), i * 2));
  return out;
}

export function bytesToIp(bytes: Buffer): string {
  if (bytes.length === 4) return [...bytes].join(".");
  return bytes.toString("hex").match(/.{4}/g)!.map((g) => g.replace(/^0+(?=.)/, "")).join(":");
}

/** Ключ для сравнения адресов независимо от записи (`::1` и `0:0:...:1` — один адрес). */
export const ipKey = (ip: string) => ipToBytes(ip).toString("hex");

const isWildcard = (ip: string) => ip === "0.0.0.0" || ip === "::";
const isLinkLocalV6 = (ip: string) => /^fe80:/i.test(ip);

/**
 * IP-адреса сервера для сертификата: HOST (если это конкретный IP), адреса сетевых интерфейсов
 * (кроме link-local), дополнительные адреса и loopback. Без дублей.
 */
export function serverIps(host: string, extra: string[]): string[] {
  const ips: string[] = [];
  if (isIP(host) && !isWildcard(host)) ips.push(host);
  for (const iface of Object.values(networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.internal || isLinkLocalV6(addr.address)) continue;
      ips.push(addr.address.split("%")[0]!);
    }
  }
  ips.push(...extra, "127.0.0.1", "::1");

  const seen = new Set<string>();
  return ips.filter((ip) => !seen.has(ipKey(ip)) && seen.add(ipKey(ip)));
}
