import { DeployError } from "../../deploy/errors";
import { runDeploy } from "../../deploy/pipeline";
import { deployQueue, type Release } from "../../deploy/queue";
import type { DeployJob } from "../../deploy/types";
import { errorMessage } from "../../shared/errors";
import { createLogger, type Logger } from "../../shared/log";
import { makeTempDir, removeQuietly } from "../../shared/fs";
import { BufferedReporter } from "../reporters/buffered";
import { StreamReporter } from "../reporters/stream";
import type { Reporter } from "../reporters/types";
import { parseDeployParams, RequestError, type DeployParams } from "../request/headers";
import { receiveArchive, type UploadedArchive } from "../request/upload";
import { errorResponse, unauthorized } from "../responses";

const newDeployId = () => crypto.randomUUID().slice(0, 8);

/** POST / — деплой. */
export function createDeployHandler(isAuthorized: (req: Request) => boolean) {
  return async function handleDeploy(req: Request): Promise<Response> {
    if (!isAuthorized(req)) return unauthorized();

    let params: DeployParams;
    try {
      params = parseDeployParams(req);
    } catch (e) {
      if (e instanceof RequestError) return errorResponse(e.status, e.message);
      throw e;
    }

    const id = newDeployId();
    const log = createLogger(`deploy ${id}`);
    const uploadDir = await makeTempDir(`deployer-${id}-u-`);

    // Приём и проверка хеша — до ответа, чтобы ошибки шли нормальными HTTP-кодами
    const uploaded = await receiveAndVerify(req, uploadDir, id, params);
    if (uploaded instanceof Response) {
      await removeQuietly(uploadDir);
      return uploaded;
    }

    const job: DeployJob = { id, archivePath: uploaded.path, service: params.service, deployDir: params.deployDir, keep: params.keep };
    log.info(`получено ${uploaded.size} байт, sha256 совпал; сервис=${job.service || "-"} каталог=${job.deployDir}`);

    const reporter = createReporter(params.streaming, id, log);
    if (params.streaming) reporter.emit("verify", `архив принят (${uploaded.size} байт), sha256 совпал`);

    // Деплой идёт в фоне относительно ответа: stream-ответ отдаётся сразу, buffered — по завершении
    void execute(job, reporter, log).finally(() => removeQuietly(uploadDir));
    return reporter.response();
  };
}

/** @returns архив или готовый HTTP-ответ с ошибкой */
async function receiveAndVerify(req: Request, dir: string, id: string, params: DeployParams): Promise<UploadedArchive | Response> {
  let archive: UploadedArchive;
  try {
    archive = await receiveArchive(req, dir);
  } catch (e) {
    return errorResponse(400, errorMessage(e), { id, step: "upload" });
  }
  if (archive.sha256 !== params.expectedSha256) {
    return errorResponse(422, "хеш не совпадает", { id, step: "verify", expected: params.expectedSha256, actual: archive.sha256 });
  }
  return archive;
}

function createReporter(streaming: boolean, id: string, log: Logger): Reporter {
  const write = (step: string, message: string) => log.child(step).info(message);
  return streaming ? new StreamReporter(id, write) : new BufferedReporter(id, write);
}

/** Очередь → деплой → итог в reporter. Никогда не бросает. */
async function execute(job: DeployJob, reporter: Reporter, log: Logger): Promise<void> {
  const started = Date.now();
  let release: Release = () => {};
  try {
    release = await deployQueue.acquire(job, (message) => reporter.emit("queue", message));
    await runDeploy(job, reporter.emit);
    reporter.success(Date.now() - started);
  } catch (e) {
    const error = DeployError.from(e);
    log.child(error.step).error(`ОШИБКА: ${error.message}`);
    reporter.failure(error);
  } finally {
    release();
    reporter.close();
  }
}
