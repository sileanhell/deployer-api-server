import type { InitSystem } from "./types";

/** Alpine Linux. */
export const openrc: InitSystem = {
  name: "openrc",
  exists: (service) => Bun.file(`/etc/init.d/${service}`).exists(),
  command: (action, service) => ["rc-service", service, action],
};
