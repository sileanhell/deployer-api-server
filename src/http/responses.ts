const JSON_HEADERS = { "content-type": "application/json" };

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body) + "\n", { status, headers: JSON_HEADERS });
}

export const errorResponse = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  json(status, { status: "error", error, ...extra });

/** Одинаковый ответ на всё неизвестное — без подсказок, какие пути и методы существуют. */
export const notFound = () => errorResponse(404, "not found");

export const unauthorized = () => errorResponse(401, "unauthorized");
