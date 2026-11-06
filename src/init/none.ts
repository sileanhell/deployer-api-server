import type { InitSystem } from "./types";

/** Init-система не обнаружена (контейнер, Windows): управление сервисами пропускается. */
export const none: InitSystem = {
  name: "none",
  exists: async () => false,
  command: () => null,
};
