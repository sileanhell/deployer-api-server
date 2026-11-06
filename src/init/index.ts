import { run } from "../shared/process";
import { detectInitSystem } from "./detect";
import { none } from "./none";
import type { InitSystem, ServiceAction } from "./types";

export type { InitSystem, InitSystemName, ServiceAction } from "./types";

let current: InitSystem = none;

/** Определяет init-систему один раз при старте сервера. */
export async function initServiceManager(): Promise<InitSystem> {
  current = await detectInitSystem();
  return current;
}

/** Init-система, определённая при старте. */
export function initSystem(): InitSystem {
  return current;
}

/** Выполняет stop/start сервиса; вывод команды отдаётся в log. Бросает ошибку при ненулевом коде. */
export async function controlService(action: ServiceAction, service: string, log: (msg: string) => void): Promise<void> {
  const cmd = current.command(action, service);
  if (!cmd) {
    log(`[${current.name}] пропускаю ${action} ${service}`);
    return;
  }
  log(`[${current.name}] ${cmd.join(" ")}`);
  const result = await run(cmd);
  if (result.output) log(result.output);
  if (result.code !== 0) throw new Error(`${cmd[0]} ${action} ${service}: код выхода ${result.code}`);
}
