import { describe, expect, it, vi } from "vitest";

import type { GitPort } from "../application/ports/git-port.ts";
import type { ProcessPort } from "../application/ports/host/process-port.ts";
import type { RecordsEditor } from "../application/ports/records/records-editor.ts";
import { repoPathOf } from "../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../domain/repository/repo-path-types.ts";
import { VERSION_TWO_PRUNE_DEBT } from "./commands.ts";
import { commandOf } from "./composed-command.ts";
import { INSTALLED_PORTS } from "./run-tool-command.ts";
import type { ToolInvocation, ToolPorts } from "./tool-ports.ts";

const FIXTURE = `${import.meta.dirname}/../operations/prune-debt/prune-debt`;
const TOOL_COMMAND_URL = new URL("../hone.ts", import.meta.url).href;
const SETTINGS_TEXT =
  '{"version":2,"ruleSets":{},"checks":{"loop-keyword#loop-statement":"walker"}}';
const DEBT_FILE = repoPathOf("hone-records/debt/loop-keyword.json");
const DOCUMENT = {
  file: DEBT_FILE,
  document: {
    version: 2,
    records: [
      { answers: "loop-keyword#loop-statement", file: "src/gone.ts" },
      { answers: "loop-keyword#loop-statement", file: "src/kept.ts" },
      { answers: "loop-keyword#loop-statement", file: "src/legacy.js" },
    ],
  },
};
const GONE = { file: DEBT_FILE, index: 0 };
const KEPT = { file: DEBT_FILE, index: 1 };
const FIXTURE_TRACKED = [
  DEBT_FILE,
  repoPathOf("hone.config.json"),
  repoPathOf("src/kept.ts"),
  repoPathOf("src/legacy.js"),
];
const TRACKED_WITHOUT_KEPT = [
  DEBT_FILE,
  repoPathOf("hone.config.json"),
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

const absoluteFixture = INSTALLED_PORTS.path.resolve({ path: FIXTURE });
if (absoluteFixture.outcome === "failed")
  throw new Error("the integration fixture did not resolve");
const settingsPath = INSTALLED_PORTS.path.join({
  segments: [absoluteFixture.value, "hone.config.json"],
});

const pruning = (request: {
  readonly process: ProcessPort;
  readonly git: GitPort;
  readonly remove: RecordsEditor["documentsWithRemoved"];
  readonly moduleUrl: string;
}) => {
  const command: ToolInvocation = { process: request.process, moduleUrl: request.moduleUrl };
  const ports: ToolPorts = {
    ...INSTALLED_PORTS,
    git: request.git,
    fileText: {
      ...INSTALLED_PORTS.fileText,
      exists: (entry: { readonly path: string }) =>
        entry.path === settingsPath ? "present" : INSTALLED_PORTS.fileText.exists(entry),
      read: (entry: { readonly path: string }) =>
        entry.path === settingsPath
          ? { outcome: "ok", value: SETTINGS_TEXT }
          : INSTALLED_PORTS.fileText.read(entry),
    },
    recordsSourceOf: () => ({
      read: () => ({ outcome: "ok", value: [DOCUMENT] }),
      readAt: () => ({ outcome: "ok", value: [DOCUMENT] }),
    }),
    recordsEditor: { ...INSTALLED_PORTS.recordsEditor, documentsWithRemoved: request.remove },
  };
  return commandOf({ tool: VERSION_TWO_PRUNE_DEBT, ports })(command);
};

const gitTrackingTheFixture = (): GitPort => gitTracking(FIXTURE_TRACKED);

const removingWhatItIsGiven = () =>
  vi
    .fn<RecordsEditor["documentsWithRemoved"]>()
    .mockReturnValue({ outcome: "ok", value: { write: [], remove: [] } });

describe("runPruneDebtCommand over a repository on disk, through this install's walker", () => {
  it("removes the debt on a file no longer on disk and the one on a file still on disk the walker measured clean, and exits 0", async () => {
    const process = processGiven(["--repo", FIXTURE]);
    const remove = removingWhatItIsGiven();
    await pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ documents: [DOCUMENT], places: [GONE, KEPT] });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 0 });
  });

  it("prunes debt on a file still on disk after Git stops tracking it", async () => {
    const remove = removingWhatItIsGiven();
    await pruning({
      process: processGiven(["--repo", FIXTURE]),
      git: gitTracking(TRACKED_WITHOUT_KEPT),
      remove,
      moduleUrl: TOOL_COMMAND_URL,
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ documents: [DOCUMENT], places: [GONE, KEPT] });
  });

  it("keeps the debt on a JavaScript file still holding its loop, which the walker is handed and skips", async () => {
    const remove = removingWhatItIsGiven();
    await pruning({
      process: processGiven(["--repo", FIXTURE]),
      git: gitTracking(FIXTURE_TRACKED),
      remove,
      moduleUrl: TOOL_COMMAND_URL,
    });
    expect(remove).toHaveBeenCalledExactlyOnceWith({ documents: [DOCUMENT], places: [GONE, KEPT] });
  });

  it("asks git for the files changed since the --base-revision it is given", async () => {
    const git = gitTrackingTheFixture();
    await pruning({
      process: processGiven(["--repo", FIXTURE, "--base-revision", "origin/main"]),
      git,
      remove: removingWhatItIsGiven(),
      moduleUrl: TOOL_COMMAND_URL,
    });
    expect(git.changedSince).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ baseRevision: "origin/main" }),
    );
  });

  it("asks git for no change set when --forfeiture elsewhere leaves forfeiture to another run", async () => {
    const git = gitTrackingTheFixture();
    await pruning({
      process: processGiven([
        "--repo",
        FIXTURE,
        "--base-revision",
        "origin/main",
        "--forfeiture",
        "elsewhere",
      ]),
      git,
      remove: removingWhatItIsGiven(),
      moduleUrl: TOOL_COMMAND_URL,
    });
    expect(git.changedSince).not.toHaveBeenCalled();
  });
});

describe("runPruneDebtCommand failing before it reaches the records", () => {
  it("exits 2 with the arguments-invalid line, removing nothing, when an argument is unknown", async () => {
    const process = processGiven(["--repo", FIXTURE, "--leave", "src/kept.ts"]);
    const remove = vi.fn<RecordsEditor["documentsWithRemoved"]>();
    await pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL });
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({
      text: expect.stringMatching(/^load failure: arguments-invalid /),
    });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("exits 2 with the config-absent line, removing nothing, when --repo holds no hone.config.json", async () => {
    const process = processGiven(["--repo", `${FIXTURE}/src`]);
    const remove = vi.fn<RecordsEditor["documentsWithRemoved"]>();
    await pruning({ process, git: gitTrackingTheFixture(), remove, moduleUrl: TOOL_COMMAND_URL });
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({
      text: expect.stringMatching(/^load failure: config-absent /),
    });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("exits 2 with the install-root-unresolvable line, removing nothing, when its module URL is not a file URL", async () => {
    const process = processGiven(["--repo", FIXTURE]);
    const remove = vi.fn<RecordsEditor["documentsWithRemoved"]>();
    await pruning({
      process,
      git: gitTrackingTheFixture(),
      remove,
      moduleUrl: "https://example.invalid/tool-command.ts",
    });
    expect(process.writeOut).toHaveBeenCalledExactlyOnceWith({
      text: expect.stringMatching(/^load failure: install-root-unresolvable /),
    });
    expect(process.exitWith).toHaveBeenCalledExactlyOnceWith({ code: 2 });
    expect(remove).not.toHaveBeenCalled();
  });
});
