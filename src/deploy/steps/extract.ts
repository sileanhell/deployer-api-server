import { assertTreeInside } from "../../files/tree-guard";
import { extractZip, isZip } from "../../files/zip";
import { runStep } from "../errors";
import type { DeployJob, Emit } from "../types";

/** Шаг 1: проверка и распаковка архива во временный каталог. */
export function extractStep(job: DeployJob, extractDir: string, emit: Emit): Promise<number> {
  return runStep("extract", async () => {
    if (!(await isZip(job.archivePath))) throw new Error("файл не является ZIP-архивом");

    emit("extract", `распаковка в ${extractDir}`);
    const { files, directories, symlinks } = await extractZip(job.archivePath, extractDir);

    // вторая линия защиты: перепроверяем готовое дерево целиком
    const total = await assertTreeInside(extractDir);
    if (total === 0) throw new Error("архив пустой");
    emit("extract", `распаковано: файлов ${files}, каталогов ${directories}, симлинков ${symlinks}`);
    return total;
  });
}
