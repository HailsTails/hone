import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import type { PathPort } from "../../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../infrastructure/node/process/process-port.ts";

export type CommandRequest = {
  readonly process: ProcessPort;
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly modules: ModuleLoaderPort;
  readonly git: GitPort;
  readonly moduleUrl: string;
};
