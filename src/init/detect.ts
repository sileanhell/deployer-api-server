import { pathExists } from "../shared/fs";
import { none } from "./none";
import { openrc } from "./openrc";
import { runit } from "./runit";
import { systemd } from "./systemd";
import type { InitSystem } from "./types";

/** Имя процесса PID 1 (systemd, runit, openrc-init, init...). */
const pid1Name = () => Bun.file("/proc/1/comm").text().then((s) => s.trim(), () => "");

const has = (bin: string) => Bun.which(bin) !== null;

/**
 * Определяет init-систему по PID 1, маркерам в /run и наличию утилит.
 * Сначала точные признаки, затем запасные — если маркеров нет, но утилиты есть.
 */
export async function detectInitSystem(): Promise<InitSystem> {
  if (process.platform !== "linux") return none;
  const pid1 = await pid1Name();

  if ((pid1 === "systemd" || (await pathExists("/run/systemd/system"))) && has("systemctl")) return systemd;
  if ((pid1 === "runit" || (await pathExists("/run/runit"))) && has("sv")) return runit;
  if ((pid1 === "openrc-init" || (await pathExists("/run/openrc"))) && has("rc-service")) return openrc;

  if (has("rc-service")) return openrc;
  if (has("sv")) return runit;
  return none;
}
