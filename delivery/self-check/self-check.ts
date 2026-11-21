import { createDefaultExceptionRepositoryOf } from "../../src/infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultGitPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultEnginePort } from "../../src/infrastructure/engines/protocol/engine-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runSelfCheck } from "./self-check-gate.ts";

await runSelfCheck({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  engine: createDefaultEnginePort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: new URL("../../src/hone.ts", import.meta.url).href,
});