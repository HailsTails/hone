#!/usr/bin/env node
import { createDefaultExceptionRepositoryOf } from "./infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { exceptionEntryParser } from "./infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "./infrastructure/disciplines-file/consumer-selection.ts";
import { shownPathOfRepository } from "./infrastructure/command-line/installation/shown-path.ts";
import { createDefaultFileTextPort } from "./infrastructure/node/file-system/file-text-port.ts";
import { createDefaultGitPort } from "./infrastructure/git/git-port.ts";
import { createDefaultModuleLoaderPort } from "./infrastructure/node/modules/module-loader-port.ts";
import { createDefaultEnginePort } from "./infrastructure/engines/protocol/engine-port.ts";
import { createDefaultPathPort } from "./infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "./infrastructure/node/process/process-port.ts";
import { runToolCommand } from "./run-tool-command.ts";

await runToolCommand({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  modules: createDefaultModuleLoaderPort({}),
  engine: createDefaultEnginePort({}),
  git: createDefaultGitPort({}),
  exceptionRepositoryOf: createDefaultExceptionRepositoryOf({}),
  exceptionEntryParser,
  selectionRepositoryOf: createSelectionRepository,
  shownPathOfRepository,
  moduleUrl: import.meta.url,
});
