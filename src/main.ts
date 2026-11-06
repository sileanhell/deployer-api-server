import { tmpdir } from "node:os";
import { config } from "./config";
import { startServer } from "./http/server";
import { initServiceManager } from "./init";
import { createLogger } from "./shared/log";
import { ensureCertificate } from "./tls";

const log = createLogger("deployer");

const tls = await ensureCertificate({ ...config.tls, host: config.host });

const init = await initServiceManager();
if (init.name === "none") createLogger("init").warn("init-система не обнаружена — шаги stop/start будут пропускаться");

const server = startServer({ port: config.port, host: config.host, apiKey: config.apiKey, tls });

log.info(`https://${config.host}:${server.port}  init=${init.name}  tmp=${tmpdir()}`);
