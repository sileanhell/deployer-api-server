import type { DeployError } from "../../deploy/errors";
import type { Emit } from "../../deploy/types";

/**
 * Как клиент получает результат деплоя. Два режима:
 *  - buffered: один JSON-ответ в конце (200 / 500);
 *  - stream:   NDJSON-поток событий, последняя строка — итог.
 */
export interface Reporter {
  emit: Emit;
  success(durationMs: number): void;
  failure(error: DeployError): void;
  /** HTTP-ответ. Для stream возвращается сразу, для buffered — после success/failure. */
  response(): Response | Promise<Response>;
  close(): void;
}
