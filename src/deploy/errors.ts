import { errorMessage } from "../shared/errors";
import type { StepName } from "./types";

/** Ошибка деплоя с указанием шага, на котором он упал. */
export class DeployError extends Error {
  constructor(
    readonly step: StepName | "unknown",
    message: string,
  ) {
    super(message);
  }

  static from(e: unknown): DeployError {
    return e instanceof DeployError ? e : new DeployError("unknown", errorMessage(e));
  }
}

/** Выполняет шаг; любая ошибка внутри помечается именем шага. */
export async function runStep<T>(step: StepName, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DeployError) throw e;
    throw new DeployError(step, errorMessage(e));
  }
}
