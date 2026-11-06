import { makeTempDir, removeQuietly } from "../shared/fs";
import { DeployError } from "./errors";
import { cleanStep } from "./steps/clean";
import { extractStep } from "./steps/extract";
import { installStep } from "./steps/install";
import { recoverService, startServiceStep, stopServiceStep } from "./steps/service";
import type { DeployJob, Emit } from "./types";

/**
 * Полный цикл деплоя: extract → stop → clean → install → start.
 * При ошибке после остановки сервиса пытается запустить его обратно. Бросает DeployError.
 */
export async function runDeploy(job: DeployJob, emit: Emit): Promise<void> {
  const extractDir = await makeTempDir(`deployer-${job.id}-x-`);
  let serviceDown = false;
  try {
    await extractStep(job, extractDir, emit);
    serviceDown = await stopServiceStep(job, emit);
    const { kept } = await cleanStep(job, emit);
    await installStep(job, extractDir, kept, emit);
    if (serviceDown) {
      serviceDown = false; // если запуск упадёт — повторять его в recover бессмысленно
      await startServiceStep(job, emit);
    }
  } catch (e) {
    if (serviceDown) await recoverService(job, emit);
    throw DeployError.from(e);
  } finally {
    await removeQuietly(extractDir);
  }
}
