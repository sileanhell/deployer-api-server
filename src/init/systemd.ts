import { run } from "../shared/process";
import type { InitSystem } from "./types";

/** Debian и большинство дистрибутивов. */
export const systemd: InitSystem = {
  name: "systemd",

  async exists(service) {
    // Для несуществующих юнитов LoadState=not-found
    const { code, stdout } = await run(["systemctl", "show", "-p", "LoadState", "--value", service]);
    const state = stdout.trim();
    return code === 0 && state !== "" && state !== "not-found";
  },

  command: (action, service) => ["systemctl", action, service],
};
