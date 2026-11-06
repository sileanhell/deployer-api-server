import { controlService, initSystem } from "../../init";
import { errorMessage } from "../../shared/errors";
import { runStep } from "../errors";
import type { DeployJob, Emit } from "../types";

/** Причина пропустить управление сервисом (null — управлять можно). */
async function skipReason(service: string): Promise<string | null> {
  if (!service) return "X-Service-Name не передан";
  const init = initSystem();
  if (init.name === "none") return "init-система не обнаружена";
  if (!(await init.exists(service))) return `сервис ${service} не найден (${init.name})`;
  return null;
}

/**
 * Шаг 2: остановка сервиса — только если он передан и существует.
 * @returns true, если сервис был остановлен (и его нужно будет запустить)
 */
export function stopServiceStep(job: DeployJob, emit: Emit): Promise<boolean> {
  return runStep("stop", async () => {
    const reason = await skipReason(job.service);
    if (reason) {
      emit("stop", `${reason} — управление сервисом пропущено`);
      return false;
    }
    emit("stop", `останавливаю сервис ${job.service}`);
    await controlService("stop", job.service, (m) => emit("stop", m));
    return true;
  });
}

/** Шаг 5: запуск сервиса. */
export function startServiceStep(job: DeployJob, emit: Emit): Promise<void> {
  return runStep("start", async () => {
    emit("start", `запускаю сервис ${job.service}`);
    await controlService("start", job.service, (m) => emit("start", m));
  });
}

/** После ошибки: пытается поднять остановленный сервис, чтобы не оставить его лежать. Не бросает. */
export async function recoverService(job: DeployJob, emit: Emit): Promise<void> {
  emit("recover", `ошибка, пытаюсь запустить ${job.service} обратно`);
  try {
    await controlService("start", job.service, (m) => emit("recover", m));
  } catch (e) {
    emit("recover", `не удалось: ${errorMessage(e)}`);
  }
}
