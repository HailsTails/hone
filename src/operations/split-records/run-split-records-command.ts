import type { RecordsSplit } from "../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { Result } from "../../domain/result.ts";
import { parseSplitRecordsArguments } from "../../infrastructure/command-line/arguments/command-arguments.ts";
import { splitRecordsCommandOutcome } from "../../infrastructure/command-line/outcomes/record-command-outcomes.ts";
import { installRootOf } from "../../infrastructure/command-line/installation/install-root.ts";
import type { LoadFailure } from "../../infrastructure/command-line/load-failure.ts";
import { repoRootOf } from "../../infrastructure/printed-report/check-locations.ts";
import { printOutcome } from "../../infrastructure/command-line/outcomes/print-outcome.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { withShownPaths } from "../check/run-check-command.ts";

const recordsSplit = (request: VersionOneCommandRequest): Result<RecordsSplit, LoadFailure> => {
  const parsed = parseSplitRecordsArguments({ arguments: request.process.arguments });
  if (parsed.outcome === "failed") {
    return parsed;
  }
  const repoRoot = repoRootOf({ path: request.path, fileText: request.fileText, repo: parsed.value.repo });
  if (repoRoot.outcome === "failed") {
    return repoRoot;
  }
  return withShownPaths({
    path: request.path,
    fileText: request.fileText,
    repoRoot: repoRoot.value,
    installRoot: installRootOf({ path: request.path, moduleUrl: request.moduleUrl }),
    run: request.exceptionRepositoryOf({ repoRoot: repoRoot.value }).moveToSplitLayout(),
  });
};

export const runSplitRecordsCommand = (request: VersionOneCommandRequest): Promise<void> => {
  printOutcome({ process: request.process, outcome: splitRecordsCommandOutcome({ result: recordsSplit(request) }) });
  return Promise.resolve();
};
