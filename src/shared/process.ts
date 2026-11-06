export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
  /** stdout + stderr без лишних пробелов. */
  output: string;
}

/** Запускает внешнюю команду (асинхронно, не блокируя другие деплои) и собирает её вывод. */
export async function run(cmd: string[]): Promise<RunResult> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code, stdout, stderr, output: (stdout + stderr).trim() };
}
