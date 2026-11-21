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

const INSTALL_ROOT = absolutePathSchema.parse("/install");
const AUDIT = mechanismIdSchema.parse("audit");

const RULE_SET_ROOT = absolutePathSchema.parse("/repo/tools/disciplines/acme");
const PIECE_ROOT = "/repo/tools/disciplines/acme/mechanisms/audit/ACME-2";
const RUNNER_PATH = "/install/mechanisms/audit/runner/runner.ts";

const FLAG_CASE = { name: "scratch file", fileName: "src/draft.scratch.ts", source: "export const draft = 1;\n", expectedLines: [1] };
const ALLOW_CASE = { name: "ordinary file", fileName: "src/kept.ts", source: "export const kept = 1;\n", expectedLines: [] };

const DISCIPLINE_TEXT = JSON.stringify({
  version: 1,
  id: "ACME-2",
  clauses: [
    {
      kind: "mechanical",
      id: "scratch-files",
      summary: "no scratch file is committed",
      mechanisms: ["audit"],
      anchor: { kind: "file" },
      cases: { flag: [FLAG_CASE], allow: [ALLOW_CASE] },
    },
  ],
});

const PIECE_TEXT = JSON.stringify({
  version: 1,
  discipline: "ACME-2",
  mechanism: "audit",
  clauses: [{ clause: "scratch-files", settings: { module: "scratch-files.ts" } }],
});

const SCRATCH_FILES = clauseAddressSchema.parse("acme/ACME-2#scratch-files");

const BOUND_CLAUSE = {
  address: SCRATCH_FILES,
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

const conformingWith = (request: { readonly returned: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>(),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue(request.returned),
});

const modulesExporting = (request: { readonly namespace: unknown }): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: request.namespace }),
});

const conformanceWith = (request: { readonly modules: ModuleLoaderPort }) =>
  clauseConformanceOf({
    fileText: acmeFileText(),
    path: acmePath(),
    engine: createDefaultEnginePort({}),
    modules: request.modules,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme",
    clause: "acme/ACME-2#scratch-files",
  });

describe("clauseConformanceOf", () => {
  it("passes when the audit runner reproduces every case", async () => {
    const runner = conformingWith({
      returned: {
        outcome: "ok",
        value: [
          { caseName: "scratch file", flaggedLines: [1] },
          { caseName: "ordinary file", flaggedLines: [] },
        ],
      },
    });
    await expect(conformanceWith({ modules: modulesExporting({ namespace: { runner } }) })).resolves.toEqual({ outcome: "ok", value: [] });
  });

  it("hands the audit runner the clause bound as hone check binds it and every case", async () => {
    const runner = conformingWith({ returned: { outcome: "ok", value: [] } });
    await conformanceWith({ modules: modulesExporting({ namespace: { runner } }) });
    expect(runner.conform).toHaveBeenCalledWith({ clause: BOUND_CLAUSE, cases: BOUND_CASES });
  });

  it("loads the installed audit runner by its path", async () => {
    const modules = modulesExporting({ namespace: { runner: conformingWith({ returned: { outcome: "ok", value: [] } }) } });
    await conformanceWith({ modules });
    expect(modules.load).toHaveBeenCalledWith({ path: RUNNER_PATH });
  });

  it("reports each case the piece does not reproduce", async () => {
    const runner = conformingWith({
      returned: {
        outcome: "ok",
        value: [
          { caseName: "scratch file", flaggedLines: [] },
          { caseName: "ordinary file", flaggedLines: [] },
        ],
      },
    });
    await expect(conformanceWith({ modules: modulesExporting({ namespace: { runner } }) })).resolves.toEqual({
      outcome: "ok",
      value: [{ clause: SCRATCH_FILES, caseName: "scratch file", expectedLines: [1], flaggedLines: [] }],
    });
  });

  it("refuses with the runner's own failure when the piece cannot run", async () => {
    const runner = conformingWith({
      returned: { outcome: "failed", error: { kind: "piece-invalid", pieceRoot: PIECE_ROOT, detail: "no check export" } },
    });
    await expect(conformanceWith({ modules: modulesExporting({ namespace: { runner } }) })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "runner-refused", detail: `runner-failed audit piece-invalid ${PIECE_ROOT} no check export` },
    });
  });

  it("refuses when the module at the runner's path exports no runner", async () => {
    await expect(conformanceWith({ modules: modulesExporting({ namespace: {} }) })).resolves.toMatchObject({
      outcome: "failed",
      error: { kind: "runner-unloadable" },
    });
  });

  it("refuses before loading the runner when the clause cannot be bound", async () => {
    const modules = modulesExporting({ namespace: {} });
    await expect(
      clauseConformanceOf({
        fileText: acmeFileText(),
        path: acmePath(),
        engine: createDefaultEnginePort({}),
        modules,
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
        mechanism: AUDIT, ruleSetRoot: "tools/disciplines/acme",
        clause: "not an address",
      }),
    ).resolves.toEqual({ outcome: "failed", error: { kind: "address-invalid", detail: "not an address" } });
    expect(modules.load).not.toHaveBeenCalled();
  });
});
