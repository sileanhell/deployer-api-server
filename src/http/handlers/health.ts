import { deployQueue } from "../../deploy/queue";
import { json } from "../responses";

/** GET / — health check: сервер жив + идущие и ожидающие деплои. */
export function handleHealth(): Response {
  return json(200, { status: "ok", ...deployQueue.snapshot() });
}
