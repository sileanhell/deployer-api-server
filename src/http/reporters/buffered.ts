import type { DeployError } from "../../deploy/errors";
import type { StepName } from "../../deploy/types";
import { json } from "../responses";
import type { Reporter } from "./types";

/** Ответ одним JSON после окончания деплоя: 200 при успехе, 500 при ошибке (с логом шагов). */
export class BufferedReporter implements Reporter {
  private readonly lines: { step: StepName; message: string }[] = [];
  private readonly result: Promise<Response>;
  private resolve!: (res: Response) => void;

  constructor(
    private readonly id: string,
    private readonly log: (step: string, message: string) => void,
  ) {
    this.result = new Promise((resolve) => (this.resolve = resolve));
  }

  emit = (step: StepName, message: string) => {
    this.log(step, message);
    this.lines.push({ step, message });
  };

  success(durationMs: number) {
    this.resolve(json(200, { id: this.id, status: "success", durationMs, log: this.lines }));
  }

  failure(error: DeployError) {
    this.resolve(json(500, { id: this.id, status: "error", step: error.step, error: error.message, log: this.lines }));
  }

  response() {
    return this.result;
  }

  close() {}
}
