import { describe, expect, it, vi } from "vitest";
import type { CheckRequest } from "../../../../application/run/check/run-check.ts";
import type { SelectionRepository } from "../../../disciplines-file/consumer-selection.ts";
import type { LoadedRunner } from "../runner-module/runner-module-schema.ts";
import type { GitPort } from "../../../git/git-port.ts";
import type { ModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createPathPort } from "../../../node/path-port.ts";
import type { SelectionReading } from "../../../../domain/settings/selection/selection.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { DEFAULT_ASSESSMENT } from "../../../hone-config-file/assessment.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { FIRST_EDITION } from "../../../content-files/edition.ts";
import { mechanismIdSchema } from "../../../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import type { Result } from "../../../../domain/result.ts";
import type { ExceptionRepository } from "../../../discipline-exceptions-folder/exception-records.ts";
import type { ExceptionRecord } from "../../../../domain/records/discipline-exceptions/exception-record.ts";
import { createVersionOneEnginePass } from "./version-one-engine-pass.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");

const INSTALL_ROOT = absolutePathSchema.parse("/install");

const RUNNER_PATH = "/install/mechanisms/audit/runner/runner.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const CLASS_SYNTAX = clauseAddressSchema.parse("CD-14#class-syntax");

const SRC_A = repoPathSchema.parse("src/a.ts");

const CLASS_SYNTAX_OBJECT = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };

const HIT_IN_A = { clause: CLASS_SYNTAX_OBJECT, file: "src/a.ts", anchor: { line: 3, column: 0 }, snippet: "class A {}" };

const CARVE_OUT_ON_A: ExceptionRecord = { kind: "file-carve-out", clause: CLASS_SYNTAX, mechanism: AUDIT, file: SRC_A, reason: "legacy class" };

const SELECTION_READING: SelectionReading = {
  selection: { selected: [{ address: CLASS_SYNTAX, mechanism: AUDIT, exceptions: "allowed" }], uncovered: [], notAdopted: [], notRun: [], editions: [] },
  bindings: [
    {
      mechanism: AUDIT,
      clause: {
        address: CLASS_SYNTAX,
        anchor: { kind: "keyword", keyword: "class" },
        pieceRoot: "/install/mechanisms/audit/CD-14",
        settings: { module: "class-syntax.ts" },
        clauseSettings: {},
        edition: FIRST_EDITION,
      },
    },
  ],
  clauseRoots: [{ clause: CLASS_SYNTAX, ruleSetRoot: INSTALL_ROOT }],
  excluded: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
};

type FakeFile = {
  readonly read: Result<string, { readonly kind: "unreadable"; readonly path: string; readonly detail: string }>;
  readonly presence: "present" | "absent";
};

const PRESENT: FakeFile = { read: { outcome: "ok", value: "" }, presence: "present" };

const ABSENT: FakeFile = { read: { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } }, presence: "absent" };

const FILES: Readonly<Record<string, FakeFile>> = {
  "/repo/src/a.ts": PRESENT,
  "/install/package.json": ABSENT,
  [RUNNER_PATH]: { read: { outcome: "ok", value: "export const runner = {};\n" }, presence: "present" },
};

const standaloneRunner = (request: { readonly runReturns: unknown }): LoadedRunner => ({
  exceptionPath: "standalone",
  run: vi.fn<LoadedRunner["run"]>().mockResolvedValue(request.runReturns),
  conform: vi.fn<LoadedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

type EmbeddedRunner = Extract<LoadedRunner, { readonly exceptionPath: "embedded" }>;

const embeddedRunner = (request: {
  readonly projection: "current" | "missing" | "not-included" | "out-of-date";
  readonly hits: readonly unknown[];
  readonly slices: readonly { readonly slice: string; readonly state: "out-of-date" | "missing" | "not-applied" | "unconfigured" | "nested-configuration" }[];
}): EmbeddedRunner => ({
  exceptionPath: "embedded",
  projectedKinds: ["config-override"],
  run: vi.fn<EmbeddedRunner["run"]>().mockResolvedValue({
    outcome: "ok",
    value: { hits: request.hits, nativeExceptions: [], projection: request.projection, slices: request.slices, unprojectedFolders: [] },
  }),
  conform: vi.fn<EmbeddedRunner["conform"]>().mockResolvedValue({ outcome: "ok", value: [] }),
  project: vi.fn<EmbeddedRunner["project"]>().mockResolvedValue({ outcome: "ok", value: [] }),
});

const modulesLoading =(module: unknown): ModuleLoaderPort => ({
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: module }),
});

const gitTracking = (request: { readonly trackedPaths: ReturnType<GitPort["trackedPaths"]> }): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>().mockReturnValue(request.trackedPaths),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const checkRequest = (overrides: Partial<CheckRequest>): CheckRequest => ({
  repoRoot: REPO_ROOT,
  installRoot: INSTALL_ROOT,
  moduleExtension: ".ts",
  baseRevision: undefined,
  assessment: DEFAULT_ASSESSMENT,
  fileText: {
    read: ({ path }) => FILES[path].read,
    exists: ({ path }) => FILES[path].presence,
  },
  modules: modulesLoading({ runner: standaloneRunner({ runReturns: { outcome: "ok", value: { hits: [HIT_IN_A], nativeExceptions: [] } } }) }),
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
  git: gitTracking({ trackedPaths: { outcome: "ok", value: [SRC_A] } }),
  selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "ok", value: SELECTION_READING }) },
  exceptionRepository: {
    read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [] }),
    readAt: vi.fn<ExceptionRepository["readAt"]>(),
  },
  ...overrides,
});

describe("createVersionOneEnginePass", () => {
  it("gives every finding of the engines, unfiltered by the records it was asked with", async () => {
    await expect(createVersionOneEnginePass({ check: checkRequest({}) }).findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "ok",
      value: {
        findings: [{ ...HIT_IN_A, mechanism: "audit" }],
        runs: [
          {
            mechanism: "audit",
            hits: [HIT_IN_A],
            nativeExceptions: [],
            coverableKinds: ["inline-disable"],
            projection: "none",
            slices: [],
            unprojectedFolders: [],
            measured: [],
          },
        ],
      },
    });
  });

  it("gives the findings of an embedded runner whose projection is current, its projected kinds as what a record can cover", async () => {
    const pass = createVersionOneEnginePass({ check: checkRequest({ modules: modulesLoading({ runner: embeddedRunner({ projection: "current", hits: [HIT_IN_A], slices: [] }) }) }) });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "ok",
      value: {
        findings: [{ ...HIT_IN_A, mechanism: "audit" }],
        runs: [
          {
            mechanism: "audit",
            hits: [HIT_IN_A],
            nativeExceptions: [],
            coverableKinds: ["config-override"],
            projection: "current",
            slices: [],
            unprojectedFolders: [],
            measured: [],
          },
        ],
      },
    });
  });

  it("fails naming the mechanism when its projection is missing, which version 1 reads as the mechanism not run", async () => {
    const pass = createVersionOneEnginePass({ check: checkRequest({ modules: modulesLoading({ runner: embeddedRunner({ projection: "missing", hits: [], slices: [] }) }) }) });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.audit.mjs", state: "missing" },
    });
  });

  it("fails naming the mechanism when its projection is not included by the team's configuration", async () => {
    const pass = createVersionOneEnginePass({ check: checkRequest({ modules: modulesLoading({ runner: embeddedRunner({ projection: "not-included", hits: [], slices: [] }) }) }) });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.audit.mjs", state: "not-included" },
    });
  });

  it("fails naming the mechanism when its projection is out of date, which version 1 itself fails", async () => {
    const pass = createVersionOneEnginePass({ check: checkRequest({ modules: modulesLoading({ runner: embeddedRunner({ projection: "out-of-date", hits: [HIT_IN_A], slices: [] }) }) }) });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "disciplines.audit.mjs", state: "out-of-date" },
    });
  });

  it("fails naming the slice when a package slice is out of date, though the root projection is current", async () => {
    const pass = createVersionOneEnginePass({
      check: checkRequest({
        modules: modulesLoading({ runner: embeddedRunner({ projection: "current", hits: [], slices: [{ slice: "packages/a/disciplines.audit.mjs", state: "out-of-date" }] }) }),
      }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "packages/a/disciplines.audit.mjs", state: "out-of-date" },
    });
  });

  it("fails naming the slice when its config does not apply it", async () => {
    const pass = createVersionOneEnginePass({
      check: checkRequest({
        modules: modulesLoading({ runner: embeddedRunner({ projection: "current", hits: [], slices: [{ slice: "packages/a/disciplines.audit.mjs", state: "not-applied" }] }) }),
      }),
    });
    await expect(pass.findingsFor({ records: [CARVE_OUT_ON_A] })).resolves.toEqual({
      outcome: "failed",
      error: { kind: "projection-not-current", file: "packages/a/disciplines.audit.mjs", state: "not-applied" },
    });
  });

  it("fails naming the selection's own problem when the version 1 selection cannot be read", async () => {
    const pass = createVersionOneEnginePass({
      check: checkRequest({
        selectionRepository: { read: vi.fn<SelectionRepository["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unexpected-error", detail: "no selection" } }) },
      }),
    });
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "unexpected-error no selection" } });
  });

  it("fails when the repository's tracked files cannot be listed", async () => {
    const pass = createVersionOneEnginePass({
      check: checkRequest({ git: gitTracking({ trackedPaths: { outcome: "failed", error: { kind: "git-failed", command: "git ls-files", detail: "not a repository" } } }) }),
    });
    await expect(pass.findingsFor({ records: [] })).resolves.toEqual({ outcome: "failed", error: { kind: "version-one-run-failed", detail: "git-failed git ls-files: not a repository" } });
  });
});
