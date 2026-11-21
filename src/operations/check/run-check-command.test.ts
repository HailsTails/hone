import { describe, expect, it, vi } from "vitest";
import { singleFileRepositoriesOver } from "../../../tests/records-disk.ts";
import { ABSENT_FILE, type FakeFile, type JsonValue, presentFile, presentJsonFile } from "../../../tests/fake-file.ts";
import { requiredEntry } from "../../../tests/required-entry.ts";
import type { LoadedRunner } from "../../infrastructure/engines/protocol/runner-module/runner-module-schema.ts";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../../infrastructure/git/git-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import { createPathPort, type PathPort } from "../../infrastructure/node/path-port.ts";
import type { ProcessPort } from "../../infrastructure/node/process/process-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { type RepoPath, repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { reportOutputSchema } from "../../infrastructure/hone-config-file/report-output.ts";
import type { VersionOneCommandRequest } from "../../application/ports/version-one-command-request.ts";
import { runCheckCommand } from "./run-check-command.ts";

const ENTRY_URL = "file:///install/src/hone.ts";

const CLASS_SYNTAX_DEFINITION = {
  kind: "mechanical",
  id: "class-syntax",
  summary: "no class syntax",
  mechanisms: ["audit"],
  anchor: { kind: "keyword", keyword: "class" },
  cases: {
    flag: [{ name: "flagged", fileName: "src/a.ts", source: "class A {}\n", expectedLines: [1] }],
    allow: [{ name: "allowed", fileName: "src/b.ts", source: "const b = 1;\n", expectedLines: [] }],
  },
};

const CLASS_SYNTAX_CLAUSES = { "CD-14#class-syntax": "audit" };

const PLAIN_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES };

const COUNTS_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, reportOutput: "counts" };

const VERDICT_ONLY_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, reportOutput: "verdict-only" };

const NOT_AN_OUTPUT_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, reportOutput: "summary" };

const CONFIGURED_OUTPUTS = [
  { output: "full", settings: { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, reportOutput: "full" } },
  { output: "failures-only", settings: { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, reportOutput: "failures-only" } },
  { output: "counts", settings: COUNTS_SETTINGS },
  { output: "verdict-only", settings: VERDICT_ONLY_SETTINGS },
];

const FORFEITURE_ELSEWHERE_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, assessment: { forfeiture: "elsewhere" } };

const FORFEITURE_THIS_RUN_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, assessment: { forfeiture: "this-run" } };

const FORFEITURE_REPORTED_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, assessment: { forfeiture: "reported" } };

const HONE_EVIDENCE_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, assessment: { eslint: { evidence: "hone" } } };

const WAIVED_NOT_RUN_SETTINGS = { version: 1, ruleSets: {}, clauses: CLASS_SYNTAX_CLAUSES, assessment: { waivedClauses: "not-run" } };

const NOTHING_SELECTED: Readonly<Record<string, FakeFile>> = {
  "/install/package.json": ABSENT_FILE,
  "/repo/disciplines.json": presentJsonFile({ document: { version: 1, ruleSets: {}, clauses: {} } }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
};

const classSyntaxSelectedWith = (request: { readonly settings: JsonValue }): Readonly<Record<string, FakeFile>> => ({
  "/repo/disciplines.json": presentJsonFile({ document: request.settings }),
  "/repo/discipline-exceptions.json": ABSENT_FILE,
  "/install/package.json": ABSENT_FILE,
  "/install/rules/CD-14/discipline.json": presentJsonFile({ document: { version: 1, id: "CD-14", clauses: [CLASS_SYNTAX_DEFINITION] } }),
  "/install/src/infrastructure/engines/audit/CD-14/piece.json": presentJsonFile({
    document: { version: 1, discipline: "CD-14", mechanism: "audit", clauses: [{ clause: "class-syntax", settings: { module: "class-syntax.ts" } }] },
  }),
  "/install/src/infrastructure/engines/audit/runner/runner.ts": presentFile({ text: "export const runner = {};\n" }),
  "/repo/src/a.ts": presentFile({ text: "class A {}\n" }),
  "/repo/disciplines.assessment.md": ABSENT_FILE,
  "/install/rules/CD-14/README.md": presentFile({ text: "# CD-14\n" }),
});

const CLASS_SYNTAX_SELECTED = classSyntaxSelectedWith({ settings: PLAIN_SETTINGS });

const fileTextOver = (files: Readonly<Record<string, FakeFile>>): FileTextPort => ({
  read: ({ path }) => files[path].read,
  exists: ({ path }) => files[path].presence,
  write: vi.fn<FileTextPort["write"]>(),
});

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const FILE_CARVE_OUT_ON_A = {
  version: 1,
  exceptions: [{ kind: "file-carve-out", clause: "CD-14#class-syntax", file: "src/a.ts", reason: "legacy class awaiting paydown" }],
};

const FILE_PATHS: Readonly<Record<string, string>> = {
  [ENTRY_URL]: "/install/src/hone.ts",
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/src/hone.ts": "/install/src",
  "/install/src": "/install",
};

const TABLE_PATH: PathPort = {
  ...POSIX_PATH,
  relative: vi.fn<PathPort["relative"]>().mockReturnValue({ relation: "different-root" }),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  fromFileUrl: ({ url }) => ({ outcome: "ok", value: absolutePathSchema.parse(FILE_PATHS[url]) }),
};

const HIT_IN_A = {
  clause: { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" },
  file: "src/a.ts",
  anchor: { line: 3, column: 0 },
  snippet: "class A {}",
};

const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading = (module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const gitTracking = (paths: readonly RepoPath[]): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue({ outcome: "ok", value: paths }),
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue({ outcome: "ok", value: [] }),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const commandRequest = (overrides: Partial<VersionOneCommandRequest>): VersionOneCommandRequest => {
  const ports = {
    process: processWith({ arguments: ["--repo", "/repo"] }),
    path: TABLE_PATH,
    fileText: fileTextOver(NOTHING_SELECTED),
    modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: { hits: [], nativeExceptions: [] } } }) }),
    git: gitTracking([]),
    moduleUrl: ENTRY_URL,
    ...overrides,
  };
  return { exceptionRepositoryOf: singleFileRepositoriesOver(ports), ...ports };
};

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

describe("runCheckCommand", () => {
  it("exits 2 with the arguments-invalid line when an argument is unknown", async () => {
    const processPort = processWith({ arguments: ["--bogus", "x"] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 0 printing the pass verdict when the report is clean", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "verdict: pass\n" }]],
      exits: [[{ code: 0 }]],
    });
  });

  it("exits 1 writing the report once when the runner finds a hit", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver(CLASS_SYNTAX_SELECTED),
        modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [] } } }) }),
        git: gitTracking([repoPathSchema.parse("src/a.ts")]),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: `findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nreadFirst (2)\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; /install/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#class-syntax: read /install/rules/CD-14/README.md#spirit\nverdict: fail\n` }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("loads the runner from the install two levels above the entry file", async () => {
    const modules = modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: { hits: [], nativeExceptions: [] } } }) });

    await runCheckCommand(
      commandRequest({ fileText: fileTextOver(CLASS_SYNTAX_SELECTED), modules, git: gitTracking([repoPathSchema.parse("src/a.ts")]) }),
    );

    expect(vi.mocked(modules.load).mock.calls).toEqual([
      [{ path: "/install/src/infrastructure/engines/audit/runner/runner.ts" }],
    ]);
  });

  it("measures the change set against the --base-revision it is given when a file carve-out needs it", async () => {
    const git = gitTracking([repoPathSchema.parse("src/a.ts")]);

    await runCheckCommand(
      commandRequest({
        process: processWith({ arguments: ["--repo", "/repo", "--base-revision", "main"] }),
        fileText: fileTextOver({
          ...CLASS_SYNTAX_SELECTED,
          "/repo/discipline-exceptions.json": presentJsonFile({ document: FILE_CARVE_OUT_ON_A }),
        }),
        git,
      }),
    );

    expect(vi.mocked(git.changedSince).mock.calls).toEqual([[{ repoRoot: "/repo", baseRevision: "main" }]]);
  });
});

const checkedWith = async (request: {
  readonly arguments: readonly string[];
  readonly settings: JsonValue;
}) => {
  const processPort = processWith({ arguments: request.arguments });
  await runCheckCommand(
    commandRequest({
      process: processPort,
      fileText: fileTextOver(classSyntaxSelectedWith({ settings: request.settings })),
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [] } } }) }),
      git: gitTracking([repoPathSchema.parse("src/a.ts")]),
    }),
  );
  return outputOf({ process: processPort });
};

const FAILING_FULL_REPORT = "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nreadFirst (2)\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; /install/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#class-syntax: read /install/rules/CD-14/README.md#spirit\nverdict: fail\n";

describe("runCheckCommand report output", () => {
  it("prints the full report when neither --report-output nor disciplines.json sets an output", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo"], settings: PLAIN_SETTINGS })).toEqual({
      writes: [[{ text: FAILING_FULL_REPORT }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("prints the output disciplines.json sets when --report-output is not given", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo"], settings: COUNTS_SETTINGS })).toEqual({
      writes: [[{ text: "findings (1)\nreadFirst (2) guidance\nverdict: fail\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("prints the output --report-output requests over the one disciplines.json sets", async () => {
    expect(
      await checkedWith({
        arguments: ["--repo", "/repo", "--report-output", "full"],
        settings: VERDICT_ONLY_SETTINGS,
      }),
    ).toEqual({ writes: [[{ text: FAILING_FULL_REPORT }]], exits: [[{ code: 1 }]] });
  });

  it.each(reportOutputSchema.options)("exits 1 for a failing run requested as %s", async (output) => {
    expect((await checkedWith({ arguments: ["--repo", "/repo", "--report-output", output], settings: PLAIN_SETTINGS })).exits).toEqual(
      [[{ code: 1 }]],
    );
  });

  it.each(CONFIGURED_OUTPUTS)("exits 1 for a failing run configured as $output", async ({ settings }) => {
    expect((await checkedWith({ arguments: ["--repo", "/repo"], settings })).exits).toEqual([[{ code: 1 }]]);
  });

  it.each(reportOutputSchema.options)("exits 0 printing the pass verdict for a clean run requested as %s", async (output) => {
    const processPort = processWith({ arguments: ["--repo", "/repo", "--report-output", output] });

    await runCheckCommand(commandRequest({ process: processPort }));

    expect(outputOf({ process: processPort })).toEqual({ writes: [[{ text: "verdict: pass\n" }]], exits: [[{ code: 0 }]] });
  });

  it("exits 2 with the arguments-invalid line naming --report-output when its value is not an output", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo", "--report-output", "summary"], settings: PLAIN_SETTINGS })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: arguments-invalid .*--report-output/) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the file-malformed line when disciplines.json sets an output that is not one", async () => {
    expect(await checkedWith({ arguments: ["--repo", "/repo"], settings: NOT_AN_OUTPUT_SETTINGS })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*reportOutput/) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the file-malformed line for an invalid disciplines.json output even when --report-output is given", async () => {
    expect(
      await checkedWith({ arguments: ["--repo", "/repo", "--report-output", "full"], settings: NOT_AN_OUTPUT_SETTINGS }),
    ).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json /) }]],
      exits: [[{ code: 2 }]],
    });
  });

  it("exits 2 with the file-unreadable line when disciplines.json cannot be read, whatever --report-output requests", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo", "--report-output", "verdict-only"] });

    await runCheckCommand(
      commandRequest({
        process: processPort,
        fileText: fileTextOver({
          ...NOTHING_SELECTED,
          "/repo/disciplines.json": {
            presence: "present",
            read: { outcome: "failed", error: { kind: "unreadable", path: "/repo/disciplines.json", detail: "EACCES" } },
          },
        }),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "load failure: file-unreadable /repo/disciplines.json EACCES\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});

const WITHIN_REPO_PATH: PathPort = {
  ...TABLE_PATH,
  relative: () => ({ relation: "within-root", path: "disciplines.json" }),
};

describe("runCheckCommand naming a file in a load failure", () => {
  it("names a file inside --repo relative to it, as the report names paths", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(
      commandRequest({
        process: processPort,
        path: WITHIN_REPO_PATH,
        fileText: fileTextOver({ ...NOTHING_SELECTED, "/repo/disciplines.json": presentFile({ text: "{" }) }),
      }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: expect.stringMatching(/^load failure: file-malformed disciplines\.json /) }]],
      exits: [[{ code: 2 }]],
    });
  });
});

describe("runCheckCommand given a folder that holds no disciplines.json", () => {
  it("exits 2 with the selection-absent line naming --repo as given", async () => {
    const processPort = processWith({ arguments: ["--repo", "/repo"] });

    await runCheckCommand(
      commandRequest({ process: processPort, fileText: fileTextOver({ ...NOTHING_SELECTED, "/repo/disciplines.json": ABSENT_FILE }) }),
    );

    expect(outputOf({ process: processPort })).toEqual({
      writes: [
        [{ text: "load failure: selection-absent /repo holds no disciplines.json; give the folder that holds it, usually the repository root\n" }],
      ],
      exits: [[{ code: 2 }]],
    });
  });
});

const carvedRunWith = async (request: {
  readonly arguments: readonly string[];
  readonly settings: JsonValue;
}) => {
  const processPort = processWith({ arguments: request.arguments });
  const git = gitTracking([repoPathSchema.parse("src/a.ts")]);
  vi.mocked(git.changedSince).mockReturnValue({ outcome: "ok", value: [repoPathSchema.parse("src/a.ts")] });
  await runCheckCommand(
    commandRequest({
      process: processPort,
      fileText: fileTextOver({
        ...classSyntaxSelectedWith({ settings: request.settings }),
        "/repo/discipline-exceptions.json": presentJsonFile({ document: FILE_CARVE_OUT_ON_A }),
      }),
      modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [] } } }) }),
      git,
    }),
  );
  return { ...outputOf({ process: processPort }), changedSince: vi.mocked(git.changedSince).mock.calls };
};

const FORFEITED_FULL_REPORT =
  "findings (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {}\nforfeited (1)\nCD-14#class-syntax audit file-carve-out src/a.ts\nreadFirst (2)\nStart from each rule's Spirit below. disciplines.assessment.md, where this repository records its own causes, forward goal and steps for a clause, is not written yet; /install/ADOPTING.md#5a-write-the-assessment says how to write it.\nCD-14#class-syntax: read /install/rules/CD-14/README.md#spirit\nverdict: fail\n";

const ELSEWHERE_FULL_REPORT =
  "exempted (1)\nCD-14#class-syntax audit src/a.ts:3:0 class A {} exempted by file-carve-out\nassessment (1)\nforfeiture elsewhere: 1 file carve-out not checked for decay in this run\nverdict: pass (partial assessment)\n";

describe("runCheckCommand forfeiture assessment", () => {
  it("assesses forfeiture in this run when neither --forfeiture nor disciplines.json sets it", async () => {
    expect(
      await carvedRunWith({ arguments: ["--repo", "/repo", "--base-revision", "main"], settings: PLAIN_SETTINGS }),
    ).toEqual({
      writes: [[{ text: FORFEITED_FULL_REPORT }]],
      exits: [[{ code: 1 }]],
      changedSince: [[{ repoRoot: "/repo", baseRevision: "main" }]],
    });
  });

  it("leaves forfeiture to another run when disciplines.json sets it elsewhere, and says so", async () => {
    expect(
      await carvedRunWith({ arguments: ["--repo", "/repo"], settings: FORFEITURE_ELSEWHERE_SETTINGS }),
    ).toEqual({ writes: [[{ text: ELSEWHERE_FULL_REPORT }]], exits: [[{ code: 0 }]], changedSince: [] });
  });

  it("leaves forfeiture to another run when --forfeiture elsewhere is given", async () => {
    expect(await carvedRunWith({ arguments: ["--repo", "/repo", "--forfeiture", "elsewhere"], settings: PLAIN_SETTINGS })).toEqual({
      writes: [[{ text: ELSEWHERE_FULL_REPORT }]],
      exits: [[{ code: 0 }]],
      changedSince: [],
    });
  });

  it("assesses forfeiture when --forfeiture this-run overrides elsewhere in disciplines.json", async () => {
    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--forfeiture", "this-run", "--base-revision", "main"],
        settings: FORFEITURE_ELSEWHERE_SETTINGS,
      }),
    ).toMatchObject({ exits: [[{ code: 1 }]], changedSince: [[{ repoRoot: "/repo", baseRevision: "main" }]] });
  });

});

describe("runCheckCommand forfeiture assessment defaults and outputs", () => {
  it("prints a report byte-identical to today's when disciplines.json sets forfeiture to this-run", async () => {
    const defaulted = await carvedRunWith({ arguments: ["--repo", "/repo", "--base-revision", "main"], settings: PLAIN_SETTINGS });

    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--base-revision", "main"],
        settings: FORFEITURE_THIS_RUN_SETTINGS,
      }),
    ).toEqual(defaulted);
  });

  it.each(["counts", "failures-only", "verdict-only"])("marks the verdict as partial for the %s output", async (output) => {
    const run = await carvedRunWith({
      arguments: ["--repo", "/repo", "--forfeiture", "elsewhere", "--report-output", output],
      settings: PLAIN_SETTINGS,
    });

    expect(run.writes).toEqual([[{ text: expect.stringMatching(/(?:^|\n)verdict: pass \(partial assessment\)\n$/) }]]);
  });

});

describe("runCheckCommand forfeiture elsewhere with a base revision", () => {
  it("runs with --forfeiture elsewhere and --base-revision, forfeiting nothing and asking git for no change set", async () => {
    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--forfeiture", "elsewhere", "--base-revision", "main"],
        settings: PLAIN_SETTINGS,
      }),
    ).toEqual({ writes: [[{ text: ELSEWHERE_FULL_REPORT }]], exits: [[{ code: 0 }]], changedSince: [] });
  });

  it("runs with --base-revision when disciplines.json sets forfeiture elsewhere, forfeiting nothing", async () => {
    expect(
      await carvedRunWith({
        arguments: ["--repo", "/repo", "--base-revision", "main"],
        settings: FORFEITURE_ELSEWHERE_SETTINGS,
      }),
    ).toEqual({ writes: [[{ text: ELSEWHERE_FULL_REPORT }]], exits: [[{ code: 0 }]], changedSince: [] });
  });
});

describe("runCheckCommand assessment configuration", () => {
  it("exits 2 with the file-malformed line naming eslint, which this release does not assess", async () => {
    expect(
      (await carvedRunWith({ arguments: ["--repo", "/repo"], settings: HONE_EVIDENCE_SETTINGS })).writes,
    ).toEqual([[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*not available in this version: "eslint"/) }]]);
  });

  it("exits 2 with the file-malformed line naming the removed waivedClauses and the clause states that replace it", async () => {
    expect(
      (await carvedRunWith({ arguments: ["--repo", "/repo"], settings: WAIVED_NOT_RUN_SETTINGS })).writes,
    ).toEqual([[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*removed: "waivedClauses"; in clauses, mark a clause "not-run"/) }]]);
  });

  it("exits 2 with the arguments-invalid line naming the removed --waived-clauses and the clause values that replace it", async () => {
    expect((await carvedRunWith({ arguments: ["--repo", "/repo", "--waived-clauses", "not-run"], settings: PLAIN_SETTINGS })).writes).toEqual([
      [{ text: expect.stringMatching(/^load failure: arguments-invalid removed: "--waived-clauses"; in clauses, mark a clause "not-run"/) }],
    ]);
  });

  it("exits 2 with the file-malformed line when disciplines.json sets a forfeiture that is not one", async () => {
    expect(
      (await carvedRunWith({ arguments: ["--repo", "/repo"], settings: FORFEITURE_REPORTED_SETTINGS })).writes,
    ).toEqual([[{ text: expect.stringMatching(/^load failure: file-malformed \/repo\/disciplines\.json .*forfeiture/) }]]);
  });
});
