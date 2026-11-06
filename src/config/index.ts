import { isIP } from "node:net";
import { resolve } from "node:path";
import { list, optionalString, positiveInt, requiredString } from "./env";

export interface Config {
  port: number;
  host: string;
  /** Ключ авторизации: `Authorization: Bearer <API_KEY>` или `X-Api-Key`. */
  apiKey: string;
  tls: {
    dir: string;
    days: number;
    /** Доп. IP для сертификата (например, внешний IP за NAT). Адреса интерфейсов берутся сами. */
    extraIps: string[];
  };
}

export const config: Config = {
  port: positiveInt("PORT", 8443),
  host: optionalString("HOST", "0.0.0.0"),
  apiKey: requiredString("API_KEY", 16),
  tls: {
    dir: resolve(optionalString("CERT_DIR", "./certs")),
    days: positiveInt("CERT_DAYS", 3650),
    extraIps: list("CERT_IPS", (ip) => (isIP(ip) ? null : `"${ip}" не является IP-адресом`)),
  },
};
