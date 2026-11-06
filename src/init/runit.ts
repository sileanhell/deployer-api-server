import { pathExists } from "../shared/fs";
import type { InitSystem } from "./types";

/** Void Linux: активные сервисы — каталоги в /var/service (или $SVDIR). */
const serviceDir = (service: string) => `${Bun.env.SVDIR || "/var/service"}/${service}`;

const STOP_TIMEOUT_SEC = "30";

export const runit: InitSystem = {
  name: "runit",
  exists: (service) => pathExists(serviceDir(service)),
  command: (action, service) => [
    "sv",
    "-w",
    STOP_TIMEOUT_SEC,
    action === "stop" ? "force-stop" : "start",
    serviceDir(service),
  ],
};
