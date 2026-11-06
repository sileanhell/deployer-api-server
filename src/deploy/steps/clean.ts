import { cleanDirectory, type CleanResult } from "../../files/clean";
import { runStep } from "../errors";
import type { DeployJob, Emit } from "../types";

/** Шаг 3: удаление старых файлов, кроме сохраняемых (X-Keep-Files). */
export function cleanStep(job: DeployJob, emit: Emit): Promise<CleanResult> {
  return runStep("clean", async () => {
    const keeping = job.keep.isEmpty ? "" : ` (сохраняю: ${job.keep.patterns.join(", ")})`;
    emit("clean", `очищаю ${job.deployDir}${keeping}`);

    const result = await cleanDirectory(job.deployDir, job.keep);
    emit("clean", `удалено: ${result.removed.length}, сохранено: ${result.kept.length}`);
    for (const path of result.kept) emit("clean", `  сохранён ${path}`);
    return result;
  });
}
