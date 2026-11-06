import { isAbsolute, parse, resolve } from "node:path";
import { KeepMatcher } from "../../files/keep-matcher";
import type { DeployTarget } from "../../deploy/types";

/** Заголовки запроса деплоя. */
export const Header = {
  SHA256: "x-archive-sha256",
  DEPLOY_DIR: "x-deploy-dir",
  SERVICE: "x-service-name",
  KEEP: "x-keep-files",
} as const;

export interface DeployParams extends DeployTarget {
  expectedSha256: string;
  keep: KeepMatcher;
  /** NDJSON-поток прогресса вместо одного ответа в конце. */
  streaming: boolean;
}

/** Ошибка в заголовках запроса → HTTP-код. */
export class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const SERVICE_NAME = /^[A-Za-z0-9@._-]+$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Явно не ZIP. Строго не проверяем: curl --data-binary шлёт form-urlencoded, формат проверяется по сигнатуре. */
const FOREIGN_CONTENT_TYPE = /^(multipart\/|text\/|application\/json)/;

function contentType(req: Request): void {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (FOREIGN_CONTENT_TYPE.test(ct)) {
    throw new RequestError(415, "принимается только ZIP в теле запроса (Content-Type: application/zip)");
  }
}

function expectedSha256(req: Request): string {
  const value = req.headers.get(Header.SHA256)?.trim().toLowerCase();
  if (!value || !SHA256_HEX.test(value)) {
    throw new RequestError(400, "заголовок X-Archive-SHA256 (hex sha256 архива) обязателен");
  }
  return value;
}

/** Необязателен: без него шаги stop/start пропускаются. */
function serviceName(req: Request): string {
  const value = req.headers.get(Header.SERVICE)?.trim() ?? "";
  if (value && !SERVICE_NAME.test(value)) throw new RequestError(400, `недопустимое имя сервиса: ${value}`);
  return value;
}

function deployDir(req: Request): string {
  const raw = req.headers.get(Header.DEPLOY_DIR)?.trim();
  if (!raw) throw new RequestError(400, "заголовок X-Deploy-Dir (абсолютный путь каталога деплоя) обязателен");
  if (!isAbsolute(raw)) throw new RequestError(400, "X-Deploy-Dir должен быть абсолютным путём");
  const dir = resolve(raw);
  if (dir === parse(dir).root) throw new RequestError(400, "нельзя деплоить в корень файловой системы");
  return dir;
}

function keepPatterns(req: Request): KeepMatcher {
  try {
    return new KeepMatcher(req.headers.get(Header.KEEP));
  } catch (e) {
    throw new RequestError(400, (e as Error).message);
  }
}

function wantsStream(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes("application/x-ndjson") || new URL(req.url).searchParams.has("stream");
}

/** Разбирает и проверяет заголовки деплоя. Бросает RequestError. */
export function parseDeployParams(req: Request): DeployParams {
  contentType(req);
  return {
    expectedSha256: expectedSha256(req),
    service: serviceName(req),
    deployDir: deployDir(req),
    keep: keepPatterns(req),
    streaming: wantsStream(req),
  };
}
