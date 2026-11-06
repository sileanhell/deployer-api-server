const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

/** Токен из `Authorization: Bearer <key>` или `X-Api-Key: <key>`. */
function extractToken(req: Request): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : (req.headers.get("x-api-key") ?? "");
}

/**
 * Проверка API-ключа. Сравниваются SHA-256 от ключей: длина всегда одинакова, а время
 * сравнения хешей ничего не говорит атакующему о самом ключе.
 */
export function createAuthorizer(apiKey: string): (req: Request) => boolean {
  const expected = sha256(apiKey);
  return (req) => sha256(extractToken(req)) === expected;
}
