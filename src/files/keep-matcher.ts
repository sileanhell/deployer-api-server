/**
 * Паттерны файлов, которые НЕ удаляются при деплое (заголовок X-Keep-Files, через запятую).
 * Синтаксис glob (Bun.Glob): `*`, `?`, `**`, `[abc]`, `{a,b}`; пути — от корня каталога деплоя.
 *
 *   .env                 файл .env в корне
 *   super-microservice*  всё в корне, что начинается с super-microservice
 *   binary.*             binary.exe, binary.conf, ...
 *   data                 каталог data целиком
 *   logs/*.log           только .log внутри logs
 *   **∕*.db              любые .db на любой глубине
 */
export class KeepMatcher {
  readonly patterns: string[];
  private readonly globs: Bun.Glob[];

  constructor(raw: string | null) {
    this.patterns = KeepMatcher.parse(raw);
    this.globs = this.patterns.map((p) => new Bun.Glob(p));
  }

  get isEmpty(): boolean {
    return this.patterns.length === 0;
  }

  /** rel — путь относительно корня деплоя через `/`. */
  matches(rel: string): boolean {
    return this.globs.some((g) => g.match(rel));
  }

  /** Может ли внутри каталога rel быть что-то сохраняемое (тогда в него надо зайти, а не удалять целиком). */
  mayContainKept(rel: string): boolean {
    const dirSegments = rel.split("/");
    return this.patterns.some((pattern) => KeepMatcher.reachesInto(pattern.split("/"), dirSegments));
  }

  private static reachesInto(patternSegments: string[], dirSegments: string[]): boolean {
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i] === "**") return true;
      if (i >= dirSegments.length) return true; // паттерн глубже каталога
      if (!new Bun.Glob(patternSegments[i]!).match(dirSegments[i]!)) return false;
    }
    return false;
  }

  private static parse(raw: string | null): string[] {
    const patterns = (raw ?? "")
      .split(/[,\n]/)
      .map((p) => p.trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/+$/, ""))
      .filter(Boolean);
    for (const p of patterns) {
      if (p.startsWith("/") || p.split("/").includes("..")) throw new Error(`недопустимый паттерн сохранения: "${p}"`);
    }
    return patterns;
  }
}
