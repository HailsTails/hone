#!/usr/bin/env node
import { createDefaultExceptionRepositoryOf } from "./infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultGitPort } from "./infrastructure/git/git-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";
import { runToolCommand } from "./run-tool-command.ts";

await runToolCommand({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  moduleUrl: import.meta.url,
});
