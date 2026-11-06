/** Чтение и проверка переменных окружения. При ошибке — сообщение и выход: без конфига сервер бесполезен. */

function fail(message: string): never {
  console.error(`[config] ${message} (см. README.md → Переменные окружения)`);
  process.exit(1);
}

function read(name: string): string | undefined {
  return Bun.env[name]?.trim() || undefined;
}

export function requiredString(name: string, minLength = 1): string {
  const value = read(name);
  if (!value) fail(`переменная окружения ${name} обязательна`);
  if (value.length < minLength) fail(`${name} слишком короткий (минимум ${minLength} символов)`);
  return value;
}

export function optionalString(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

export function positiveInt(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) fail(`${name} должно быть положительным целым числом, получено "${raw}"`);
  return n;
}

/** Список через запятую; validate возвращает текст ошибки для неверного элемента. */
export function list(name: string, validate?: (item: string) => string | null): string[] {
  const items = (read(name) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const item of items) {
    const problem = validate?.(item);
    if (problem) fail(`${name}: ${problem}`);
  }
  return items;
}
