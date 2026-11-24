import { createDefaultGitHistoryPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runReleasePullRequest } from "./release-pull-request.ts";

runReleasePullRequest({
  process: createDefaultProcessPort({}),
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  history: createDefaultGitHistoryPort(),
  moduleUrl: import.meta.url,
});
