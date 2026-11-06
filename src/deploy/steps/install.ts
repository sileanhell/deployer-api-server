import { installFiles } from "../../files/install";
import { runStep } from "../errors";
import type { DeployJob, Emit } from "../types";

/** Шаг 4: копирование новых файлов; сохранённые на шаге clean не перезаписываются. */
export function installStep(job: DeployJob, extractDir: string, kept: string[], emit: Emit): Promise<void> {
  return runStep("install", async () => {
    emit("install", `копирую новые файлы в ${job.deployDir}`);
    const skipped = await installFiles(extractDir, job.deployDir, new Set(kept));
    for (const path of skipped) emit("install", `  пропущен (сохраняемый, уже есть): ${path}`);
  });
}
