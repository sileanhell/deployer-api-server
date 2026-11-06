import { join } from "node:path";
import { errorMessage } from "../shared/errors";
import { createLogger } from "../shared/log";
import { generateSelfSigned } from "./generate";
import { inspectCertificate } from "./inspect";
import { ipKey, serverIps } from "./ip";
import { fingerprint, fromPem } from "./pem";

const log = createLogger("tls");
const RENEW_BEFORE_MS = 7 * 86_400_000;

export interface TlsOptions {
  dir: string;
  days: number;
  host: string;
  extraIps: string[];
}

export interface TlsFiles {
  cert: string;
  key: string;
}

/** Почему существующий сертификат не годится (null — годится). */
async function staleReason(certPath: string, keyPath: string, ips: string[]): Promise<string | null> {
  const cert = Bun.file(certPath);
  if (!(await cert.exists()) || !(await Bun.file(keyPath).exists())) return "сертификата ещё нет";
  try {
    const info = inspectCertificate(fromPem(await cert.text()));
    if (info.notAfter.getTime() < Date.now() + RENEW_BEFORE_MS) {
      return `сертификат истекает/истёк (${info.notAfter.toISOString()})`;
    }
    const missing = ips.filter((ip) => !info.ipKeys.has(ipKey(ip)));
    if (missing.length) return `в сертификате нет адресов ${missing.join(", ")}`;
    return null;
  } catch (e) {
    return `не удалось прочитать ${certPath}: ${errorMessage(e)}`;
  }
}

async function writeKeyPair(certPath: string, keyPath: string, ips: string[], days: number): Promise<void> {
  const pair = await generateSelfSigned(ips, days);
  // mode применяется только при создании файла — старый ключ сначала удаляем
  await Bun.file(keyPath).delete().catch(() => {});
  await Bun.write(keyPath, pair.key, { createPath: true, mode: 0o600 });
  await Bun.write(certPath, pair.cert, { createPath: true });
}

/**
 * Возвращает пути к сертификату и ключу. Выпускает новый самоподписной сертификат на IP сервера,
 * если его нет, он истекает в ближайшие 7 дней или IP сервера сменился.
 */
export async function ensureCertificate(options: TlsOptions): Promise<TlsFiles> {
  const files = { cert: join(options.dir, "cert.pem"), key: join(options.dir, "key.pem") };
  const ips = serverIps(options.host, options.extraIps);

  const reason = await staleReason(files.cert, files.key, ips);
  if (reason) {
    log.info(`${reason} — генерирую самоподписной сертификат в ${options.dir}`);
    await writeKeyPair(files.cert, files.key, ips, options.days);
  }

  const der = fromPem(await Bun.file(files.cert).text());
  const info = inspectCertificate(der);
  log.info(`IP: ${info.ips.join(", ")}; до ${info.notAfter.toISOString()}`);
  log.info(`SHA256 fingerprint: ${fingerprint(der)}`);
  return files;
}
