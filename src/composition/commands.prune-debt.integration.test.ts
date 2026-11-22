import { describe, expect, it, vi } from "vitest";
import { createDefaultExceptionRepositoryOf } from "../infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepository } from "../application/ports/records/exception-repository.ts";
import { createDefaultFileTextPort } from "../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../application/ports/git-port.ts";
import { createDefaultModuleLoaderPort } from "../infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import type { VersionOneCommandRequest } from "../application/ports/version-one-command-request.ts";
import { commandOf } from "./composed-command.ts";
import type { VersionOneCommandRequest as PruneCommand } from "../application/ports/version-one-command-request.ts";
import { PRUNE_DEBT } from "./commands.ts";
import { createDefaultEnginePort } from "../infrastructure/engines/protocol/engine-port.ts";
import { exceptionEntryParser } from "../infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../infrastructure/disciplines-file/consumer-selection.ts";
import { shownPathOfRepository } from "../infrastructure/command-line/installation/shown-path.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import { disciplineIdOf } from "../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../domain/rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../domain/rule-set/clause-address.ts";

const runPruneDebtCommand = (command: PruneCommand) => commandOf({ tool: PRUNE_DEBT, ports: command })(command);

const FIXTURE = `${import.meta.dirname}/../operations/prune-debt/prune-debt`;

const TOOL_COMMAND_URL = new URL("../hone.ts", import.meta.url).href;

const LOOPS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") };

const GONE_PAIR = { clause: LOOPS, file: repoPathOf("src/gone.ts") };

const KEPT_PAIR = { clause: LOOPS, file: repoPathOf("src/kept.ts") };

const FIXTURE_TRACKED = [
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("disciplines.json"),
  repoPathOf("src/kept.ts"),
];

const TRACKED_WITHOUT_KEPT = [repoPathOf("discipline-exceptions.json"), repoPathOf("disciplines.json")];

const TRACKED_WITH_LEGACY_SCRIPT = [
  repoPathOf("discipline-exceptions.json"),
  repoPathOf("disciplines.json"),
  repoPathOf("src/kept.ts"),
  repoPathOf("src/legacy.js"),
];

const processGiven = (argumentsGiven: readonly string[]): ProcessPort => ({
  arguments: argumentsGiven,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const gitTracking = (tracked: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: tracked }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const pruning = (request: {
  readonly process: ProcessPort;
  readonly git: GitPort;
  readonly remove: ExceptionRepository["remove"];
  readonly moduleUrl: string;
}): VersionOneCommandRequest => ({
  process: request.process,
  path: createDefaultPathPort({}),
  fileText: createDefaultFileTextPort({}),
  engine: createDefaultEnginePort({}),
  modules: createDefaultModuleLoaderPort({}),
  git: request.git,
  exceptionRepositoryOf: (repository) => ({ ...createDefaultExceptionRepositoryOf({})(repository), remove: request.remove }),
  exceptionEntryParser,
  selectionRepositoryOf: createSelectionRepository,
  shownPathOfRepository,
  moduleUrl: request.moduleUrl,
});

const gitTrackingTheFixture = (): GitPort => gitTracking(FIXTURE_TRACKED);

const removingWhatItIsGiven = () => vi.fn<ExceptionRepository["remove"]>().mockReturnValue({ outcome: "ok", value: [GONE_PAIR] });

describe("runPruneDebtCommand over a repository on disk, through this install's audit runner", () => {
  it("removes the carve-out on a file no longer on disk and the one on a file still on disk the audit runner measured clean, and exits 0", async () => {
    const process = processGiven(["--repo", FIXTURE]);
    const remove = removingWhatItIsGiven();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(remove).toHaveBeenCalledExactlyOnceWith({ pairs: [GONE_PAIR, KEPT_PAIR] });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 0 });
  });

  it("keeps the carve-out on a file still on disk that git no longer tracks, which no runner was handed", async () => {
    const remove = removingWhatItIsGiven();
    await runPruneDebtCommand(pruning({ process: processGiven(["--repo", FIXTURE]), git: gitTracking(TRACKED_WITHOUT_KEPT), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(remove).toHaveBeenCalledExactlyOnceWith({ pairs: [GONE_PAIR] });
  });

  it("keeps the carve-out on a JavaScript file still holding its loop, which the audit runner is handed and skips", async () => {
    const remove = removingWhatItIsGiven();
    await runPruneDebtCommand(
      pruning({ process: processGiven(["--repo", FIXTURE]), git: gitTracking(TRACKED_WITH_LEGACY_SCRIPT), remove, moduleUrl: TOOL_COMMAND_URL }),
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith({ pairs: [GONE_PAIR, KEPT_PAIR] });
  });

  it("asks git for the files changed since the --base-revision it is given", async () => {
    const git = gitTrackingTheFixture();
    await runPruneDebtCommand(
      pruning({ process: processGiven(["--repo", FIXTURE, "--base-revision", "origin/main"]), git, remove: removingWhatItIsGiven(), moduleUrl: TOOL_COMMAND_URL }),
    );
    expect(git.changedSince).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ baseRevision: "origin/main" }));
  });

  it("asks git for no change set when --forfeiture elsewhere leaves forfeiture to another run", async () => {
    const git = gitTrackingTheFixture();
    await runPruneDebtCommand(
      pruning({
        process: processGiven(["--repo", FIXTURE, "--base-revision", "origin/main", "--forfeiture", "elsewhere"]),
        git,
        remove: removingWhatItIsGiven(),
        moduleUrl: TOOL_COMMAND_URL,
      }),
    );
    expect(git.changedSince).not.toHaveBeenCalled();
  });
});

describe("runPruneDebtCommand failing before it reaches the records", () => {
  it("exits 2 with the arguments-invalid line, removing nothing, when an argument is unknown", async () => {
    const process = processGiven(["--repo", FIXTURE, "--leave", "src/kept.ts"]);
    const remove = vi.fn<ExceptionRepository["remove"]>();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({ text: expect.stringMatching(/^load failure: arguments-invalid /) });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("exits 2 with the selection-absent line, removing nothing, when --repo holds no disciplines.json", async () => {
    const process = processGiven(["--repo", `${FIXTURE}/src`]);
    const remove = vi.fn<ExceptionRepository["remove"]>();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL }));
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({ text: expect.stringMatching(/^load failure: selection-absent /) });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("exits 2 with the install-root-unresolvable line, removing nothing, when its module URL is not a file URL", async () => {
    const process = processGiven(["--repo", FIXTURE]);
    const remove = vi.fn<ExceptionRepository["remove"]>();
    await runPruneDebtCommand(pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: "https://example.invalid/tool-command.ts" }));
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({ text: expect.stringMatching(/^load failure: install-root-unresolvable /) });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });
});
