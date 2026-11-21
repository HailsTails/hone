import { describe, expect, it, vi } from "vitest";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { CheckRequest } from "../../run/check/run-check.ts";
import type { DirectoryPort } from "../../../infrastructure/node/file-system/file-system-port.ts";
import type { GitPort, GitTreePort } from "../../../infrastructure/git/git-port.ts";
import { createPathPort } from "../../../infrastructure/node/path-port.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import type { RecordsSourceOf } from "../../../infrastructure/hone-records-folder/folder-layout/records-folder.ts";
import type { RecordsSource } from "../../ports/records-source.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRepository } from "../../../infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { PlacedEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import { FOUND_TREE_REVISION, foundTreeCheckReachOf, foundTreeRunReachOf } from "./found-tree-reach.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const ESLINT = mechanismIdSchema.parse("eslint");

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = { name: "debt", title: "Debt", phrase: "debt", todaysFormat: "file-carve-out" };

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker", mechanism: AUDIT };

const ESLINT_ENGINE: Engine = { name: "eslint", mechanism: ESLINT };

const LOOP_KEYWORD: Symptom = {
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = {
  name: "rebinding",
  title: "Rebinding",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT_ENGINE], forms: [] };

const LOOP_KEYWORD_TEST_BODY: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const REBINDING_TEST_BODY: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  alwaysRecordable: { debt: DEBT_KIND, authorisedLocation: AUTHORISED_LOCATION_KIND },
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    { clause: LOOPS_CLAUSE, sight: { kind: "one-symptom", symptom: LOOP_KEYWORD } },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { section: "a-for-loop", symptom: LOOP_KEYWORD },
          { section: "a-let", symptom: REBINDING },
        ],
      },
    },
    { clause: LAYERING_CLAUSE, sight: { kind: "one-symptom", symptom: REBINDING } },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const REPO_ROOT = absolutePathSchema.parse("/repo");

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const ENTRY = { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" } as const;

const PLACED: PlacedEntry = { place: { layout: "single-file", file: repoPathSchema.parse("discipline-exceptions.json"), index: 0 }, entry: ENTRY };

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: repoPathSchema.parse("hone-records/authorised-locations/loop-keyword.json"),
  document: { version: 2, records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: ENTRY }] },
};

const git = (): GitPort => ({
  trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const fileText = (): CheckRequest["fileText"] => ({
  read: vi.fn<CheckRequest["fileText"]["read"]>(),
  exists: vi.fn<CheckRequest["fileText"]["exists"]>(),
});

const exceptions = (): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [PLACED] }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
  add: vi.fn<ExceptionRepository["add"]>(),
  remove: vi.fn<ExceptionRepository["remove"]>(),
  moveToSplitLayout: vi.fn<ExceptionRepository["moveToSplitLayout"]>(),
});

describe("foundTreeCheckReachOf", () => {
  it("gives a version 1 check the tree the upgrade found as its base revision, git and entries at the base", () => {
    const underlyingGit = git();
    const underlyingExceptions = exceptions();
    const reach = foundTreeCheckReachOf({ check: { git: underlyingGit, fileText: fileText(), path: PATH, exceptionRepository: underlyingExceptions } });
    expect({
      baseRevision: reach.baseRevision,
      changedSince: reach.git.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      entriesAtBase: reach.exceptionRepository.readAt({ revision: FOUND_TREE_REVISION }),
      askedGit: [vi.mocked(underlyingGit.changedSince).mock.calls, vi.mocked(underlyingExceptions.readAt).mock.calls],
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changedSince: { outcome: "ok", value: [] },
      entriesAtBase: { outcome: "ok", value: [ENTRY] },
      askedGit: [[], []],
    });
  });
});

describe("foundTreeRunReachOf", () => {
  it("gives a version 2 run the tree the upgrade found as its base revision and git, and records at the base made from the working tree's entries", () => {
    const underlyingSource: RecordsSource = { read: vi.fn<RecordsSource["read"]>(), readAt: vi.fn<RecordsSource["readAt"]>() };
    const underlyingGit = git();
    const directory: Pick<DirectoryPort, "list"> = { list: vi.fn<DirectoryPort["list"]>() };
    const gitTree: GitTreePort = { pathsAt: vi.fn<GitTreePort["pathsAt"]>() };
    const reach = foundTreeRunReachOf({
      recordsSourceOf: vi.fn<RecordsSourceOf>().mockReturnValue(underlyingSource),
      command: { git: underlyingGit, fileText: fileText(), path: PATH, exceptionRepositoryOf: () => exceptions() },
    });
    const folder = { fileText: fileText(), path: PATH, directory, git: underlyingGit, gitTree, repoRoot: REPO_ROOT, catalogue: SETTINGS_CATALOGUE };
    expect({
      baseRevision: reach.baseRevision,
      changedSince: reach.git.changedSince({ repoRoot: REPO_ROOT, baseRevision: FOUND_TREE_REVISION }),
      recordsAtBase: reach.recordsSourceOf(folder).readAt({ revision: FOUND_TREE_REVISION }),
      askedRecords: vi.mocked(underlyingSource.readAt).mock.calls,
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changedSince: { outcome: "ok", value: [] },
      recordsAtBase: { outcome: "ok", value: [AUTHORISED_DOCUMENT] },
      askedRecords: [],
    });
  });
});
