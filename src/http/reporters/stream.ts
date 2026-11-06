import type { DeployError } from "../../deploy/errors";
import type { StepName } from "../../deploy/types";
import type { Reporter } from "./types";

const encoder = new TextEncoder();

/**
 * NDJSON-поток: каждая строка — событие `{ts,id,step,message}`, последняя — `{status:"success"|"error"}`.
 * HTTP-код всегда 200 (заголовки уходят сразу), поэтому клиент проверяет последнюю строку.
 */
export class StreamReporter implements Reporter {
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  private readonly stream: ReadableStream<Uint8Array>;

  constructor(
    private readonly id: string,
    private readonly log: (step: string, message: string) => void,
  ) {
    this.stream = new ReadableStream({ start: (c) => void (this.controller = c) });
  }

  emit = (step: StepName, message: string) => {
    this.log(step, message);
    this.send({ step, message });
  };

  success(durationMs: number) {
    this.send({ status: "success", durationMs });
  }

  failure(error: DeployError) {
    this.send({ status: "error", step: error.step, error: error.message });
  }

  response() {
    return new Response(this.stream, {
      status: 200,
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        "x-deploy-id": this.id,
      },
    });
  }

  close() {
    try {
      this.controller.close();
    } catch {}
  }

  private send(event: Record<string, unknown>) {
    try {
      this.controller.enqueue(encoder.encode(JSON.stringify({ ts: new Date().toISOString(), id: this.id, ...event }) + "\n"));
    } catch {
      // клиент отключился — деплой всё равно доводим до конца
    }
  }
}
