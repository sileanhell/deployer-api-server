import type { Server } from "bun";
import type { TlsFiles } from "../tls";
import { createAuthorizer } from "./auth";
import { createDeployHandler } from "./handlers/deploy";
import { handleHealth } from "./handlers/health";
import { errorResponse, notFound } from "./responses";

export interface ServerOptions {
  port: number;
  host: string;
  apiKey: string;
  tls: TlsFiles;
}

/**
 * HTTPS-сервер. Единственный путь — корень: GET/HEAD = health check, POST = деплой.
 * Всё остальное (другие пути и методы) — одинаковый 404 без подсказок.
 */
export function startServer(options: ServerOptions): Server<undefined> {
  const handleDeploy = createDeployHandler(createAuthorizer(options.apiKey));

  return Bun.serve({
    port: options.port,
    hostname: options.host,
    tls: { cert: Bun.file(options.tls.cert), key: Bun.file(options.tls.key) },
    maxRequestBodySize: Number.MAX_SAFE_INTEGER, // размер архива не ограничен

    fetch(req, server) {
      if (new URL(req.url).pathname !== "/") return notFound();

      switch (req.method) {
        case "GET":
        case "HEAD":
          return handleHealth();
        case "POST":
          server.timeout(req, 0); // загрузка, ожидание в очереди и деплой могут длиться сколько угодно
          return handleDeploy(req);
        default:
          return notFound();
      }
    },

    error(e) {
      console.error(e);
      return errorResponse(500, "internal error");
    },
  });
}
