import { describe, expect, it, vi } from "vitest";
import type { LoadedRunner } from "../ports/engine/runner-module.ts";
import type { FileTextPort } from "../ports/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../ports/host/module-loader-port.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { clauseConformanceOf } from "./clause-conformance.ts";
import { createDefaultEnginePort } from "../../infrastructure/engines/protocol/engine-port.ts";
import { createRuleSetFileReader } from "../../infrastructure/content-files/rule-sets/rule-set-reader.ts";
import { loadFailureDetail } from "../../infrastructure/printed-report/load-failures/load-failure-text.ts";
import type { RuleSetReading } from "./clause-under-test.ts";

const ruleSetReadingOf = (request: { readonly fileText: FileTextPort; readonly path: PathPort }): Pick<RuleSetReading, "ruleSetFiles" | "loadFailureDetail" | "path"> => ({
  ruleSetFiles: createRuleSetFileReader(request),
  loadFailureDetail,
  path: request.path,
});

const INSTALL_ROOT = absolutePathSchema.parse("/install");
const MECHANISM = mechanismIdSchema.parse("audit");

const RULE_SET_ROOT = absolutePathSchema.parse("/repo/tools/disciplines/acme");
const PIECE_ROOT = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2";
const RUNNER_PATH = "/install/mechanisms/audit/runner/runner.ts";

const ALLOW_CASE = { name: "ordinary file", fileName: "src/kept.ts", source: "export const kept = 1;\n", expectedLines: [] };

const FLAG_CASE = { name: "scratch file", fileName: "src/draft.scratch.ts", source: "export const draft = 1;\n", expectedLines: [1] };

const DISCIPLINE_TEXT =
  '{"version":1,"id":"ACME-2","clauses":[{"kind":"mechanical","id":"scratch-files","summary":"no scratch file is committed","mechanisms":["audit"],"anchor":{"kind":"file"},"cases":{"flag":[{"name":"scratch file","fileName":"src/draft.scratch.ts","source":"export const draft = 1;\\n","expectedLines":[1]}],"allow":[{"name":"ordinary file","fileName":"src/kept.ts","source":"export const kept = 1;\\n","expectedLines":[]}]}}]}';

const PIECE_TEXT = '{"version":1,"discipline":"ACME-2","mechanism":"audit","clauses":[{"clause":"scratch-files","settings":{"module":"scratch-files.ts"}}]}';

const BOUND_CLAUSE = {
  address: clauseAddressSchema.parse("acme/ACME-2#scratch-files"),
  anchor: { kind: "file" },
  pieceRoot: PIECE_ROOT,
  settings: { module: "scratch-files.ts" },
  clauseSettings: {},
  edition: "1",
};

const BOUND_CASES = [
  { ...FLAG_CASE, fileName: repoPathSchema.parse(FLAG_CASE.fileName) },
  { ...ALLOW_CASE, fileName: repoPathSchema.parse(ALLOW_CASE.fileName) },
];

const REPRODUCING_EVERY_CASE = {
  outcome: "ok",
  value: [
    { caseName: "scratch file", flaggedLines: [1] },
    { caseName: "ordinary file", flaggedLines: [] },
  ],
};

const acmeFileText = (): FileTextPort => ({
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce({ outcome: "ok", value: DISCIPLINE_TEXT })
    .mockReturnValueOnce({ outcome: "ok", value: PIECE_TEXT }),
  exists: vi.fn(),
  write: vi.fn(),
});

const acmePath = (): PathPort => ({
  join: vi
    .fn<PathPort["join"]>()
    .mockReturnValueOnce("/repo/tools/disciplines/acme/rules/ACME-2/discipline.json")
    .mockReturnValueOnce("/repo/tools/disciplines/acme/mechanisms/audit/ACME-2/piece.json")
    .mockReturnValueOnce(PIECE_ROOT)
    .mockReturnValueOnce(RUNNER_PATH),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn(),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: RULE_SET_ROOT }),
  fromFileUrl: vi.fn(),
});

const standaloneRunner = () => ({
  exceptionPath: "standalone" as const,
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue(REPRODUCING_EVERY_CASE),
});

const embeddedRunner = () => ({
  exceptionPath: "embedded" as const,
  projectedKinds: [],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>(),
  project: vi.fn<LoadedRunner["run"]>(),
});

const checksRunner = () => ({
  projectedKinds: [],
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue(REPRODUCING_EVERY_CASE),
  project: vi.fn<LoadedRunner["run"]>(),
});

const conformanceOver = (namespace: unknown) =>
  clauseConformanceOf({
    ...ruleSetReadingOf({ fileText: acmeFileText(), path: acmePath() }),
    engine: createDefaultEnginePort({}),
    modules: { load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: namespace }) },
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    mechanism: MECHANISM,
    ruleSetRoot: "tools/disciplines/acme",
    clause: "acme/ACME-2#scratch-files",
  });

describe("clauseConformanceOf, by the kind of engine the runner module declares", () => {
  it("asks a standalone runner's conform, even when the module also exports a checks runner", async () => {
    const runner = standaloneRunner();
    const checks = checksRunner();
    await expect(conformanceOver({ runner, checksRunner: checks })).resolves.toEqual({ outcome: "ok", value: [] });
    expect({ standalone: runner.conform.mock.calls, checks: checks.conform.mock.calls }).toEqual({
      standalone: [[{ clause: BOUND_CLAUSE, cases: BOUND_CASES }]],
      checks: [],
    });
  });

  it("asks the checks runner's conform, never the embedded runner's, for an engine that runs through a native tool", async () => {
    const runner = embeddedRunner();
    const checks = checksRunner();
    await expect(conformanceOver({ runner, checksRunner: checks })).resolves.toEqual({ outcome: "ok", value: [] });
    expect({ embedded: runner.conform.mock.calls, checks: checks.conform.mock.calls }).toEqual({
      embedded: [],
      checks: [[{ clause: BOUND_CLAUSE, cases: BOUND_CASES }]],
    });
  });

  it("reports the checks runner's own failure to reproduce a case", async () => {
    const checks = { ...checksRunner(), conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [{ caseName: "scratch file", flaggedLines: [] }, { caseName: "ordinary file", flaggedLines: [] }] }) };
    await expect(conformanceOver({ runner: embeddedRunner(), checksRunner: checks })).resolves.toEqual({
      outcome: "ok",
      value: [
        {
          caseName: "scratch file",
          clause: { clause: "scratch-files", discipline: "ACME-2", ruleSet: { name: "acme" } },
          expectedLines: [1],
          flaggedLines: [],
        },
      ],
    });
  });

  it("is runner-unloadable, in the words conformance needs, when a native-tool engine exports no checks runner", async () => {
    const runner = embeddedRunner();
    await expect(conformanceOver({ runner })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "the runner module exports no checksRunner, which version 2 conformance needs of an engine that runs through a native tool",
      },
    });
    expect(runner.conform).not.toHaveBeenCalled();
  });

  it("is runner-unloadable when the checks runner exports no conform", async () => {
    const withoutConform = { projectedKinds: [], run: vi.fn<LoadedRunner["run"]>(), project: vi.fn<LoadedRunner["run"]>() };
    await expect(conformanceOver({ runner: embeddedRunner(), checksRunner: withoutConform })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "runner-invalid audit ✖ Invalid input: expected function, received undefined\\n  → at checksRunner.conform",
      },
    });
  });
});
