export type InitSystemName = "systemd" | "openrc" | "runit" | "none";

export type ServiceAction = "stop" | "start";

/** Драйвер init-системы: всё, что деплою нужно знать про управление сервисами. */
export interface InitSystem {
  readonly name: InitSystemName;
  /** Существует ли сервис в системе. */
  exists(service: string): Promise<boolean>;
  /** Команда для действия над сервисом (null — управление не поддерживается). */
  command(action: ServiceAction, service: string): string[] | null;
}
