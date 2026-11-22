import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { MechanismId } from "../../../domain/rule-set/identifier-types.ts";
import type { ModuleExtension } from "../host/module-extension.ts";
import type { ModuleLoaderPort } from "../host/module-loader-port.ts";
import type { PathPort } from "../host/path-port.ts";

export type RunnerLocation = {
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly modules: ModuleLoaderPort;
  readonly path: Pick<PathPort, "join">;
  readonly mechanism: MechanismId;
};

export type RunnerInvalid = {
  readonly kind: "runner-invalid";
  readonly mechanism: MechanismId;
  readonly detail: string;
};
