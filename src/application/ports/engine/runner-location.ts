import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { EngineId } from "../../../domain/rule-set/identifier-types.ts";
import type { ModuleExtension } from "../host/module-extension.ts";
import type { ModuleLoad, ModuleLoaderPort } from "../host/module-loader-port.ts";
import type { PathPort } from "../host/path-port.ts";

export type RunnerLocation = {
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly modules: ModuleLoaderPort;
  readonly path: Pick<PathPort, "join">;
  readonly mechanism: EngineId;
};

export type RunnerModuleOf = (location: RunnerLocation) => Promise<ModuleLoad>;

export type RunnerInvalid = {
  readonly kind: "runner-invalid";
  readonly mechanism: EngineId;
  readonly detail: string;
};
