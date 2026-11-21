import type { FileTextPort } from "./file-system/file-text-port.ts";
import type { GitPort } from "./git-port.ts";
import type { ModuleLoaderPort } from "./host/module-loader-port.ts";
import type { PathPort } from "./host/path-port.ts";
import type { ProcessPort } from "./host/process-port.ts";

export type CommandRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
  readonly moduleUrl: string;
};
