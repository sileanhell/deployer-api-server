/** Простой логгер с префиксом-областью: `[tls] ...`, `[deploy ab12cd34] [extract] ...`. */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string | Error): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    info: (message) => console.log(prefix, message),
    warn: (message) => console.warn(prefix, message),
    error: (message) => console.error(prefix, message),
    child: (sub) => createLogger(`${scope}] [${sub}`),
  };
}
