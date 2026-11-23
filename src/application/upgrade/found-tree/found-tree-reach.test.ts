import { describe, expect, it, vi } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import type { PlacedEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { RecordsDocument } from "../../../domain/records/hone-records/hone-record.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { DirectoryPort } from "../../ports/file-system/directory-port.ts";
import type { GitPort, GitTreePort } from "../../ports/git-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import type {
  FoundTreeRecordsSourceOf,
  RecordsSourceOf,
} from "../../ports/records/records-source-of.ts";
import type { RecordsSource } from "../../ports/records/records-source.ts";
import type { LoadFailureDetail } from "../../ports/report/load-failure-detail.ts";
import type { VersionOneCheckInput } from "../record-answers/version-one-check-input.ts";
import {
  FOUND_TREE_REVISION,
  foundTreeCheckReachOf,
  foundTreeRunReachOf,
} from "./found-tree-reach.ts";

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

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

const LOOPS_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: LOOP_KEYWORD,
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: LOOP_KEYWORD,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: REBINDING,
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
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

const REPO_ROOT = absoluteRootOf("/repo");

const PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  directoryOf: vi.fn<PathPort["directoryOf"]>(),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: vi.fn<PathPort["resolve"]>(),
  fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
};

const loadFailureDetail: LoadFailureDetail = () => "the failure in words";

const ENTRY = {
  kind: "authorised-location",
  clause: "CD-15#loops",
  file: "src/a.ts",
  reason: "kept",
} as const;

const PLACED: PlacedEntry = {
  place: { layout: "single-file", file: repoPathOf("discipline-exceptions.json"), index: 0 },
  entry: ENTRY,
};

const AUTHORISED_DOCUMENT: RecordsDocument = {
  file: repoPathOf("hone-records/authorised-locations/loop-keyword.json"),
  document: {
    version: 2,
    records: [{ answers: "loop-keyword#loops", file: "src/a.ts", carried: ENTRY }],
  },
};

const TRACKED = repoPathOf("src/a.ts");

const WRITTEN = repoPathOf("hone.eslint.d.mts");

const git = (): GitPort => ({
  trackedPaths: vi
    .fn<GitPort["trackedPaths"]>()
    .mockReturnValue({ outcome: "ok", value: [TRACKED] }),
  changedSince: vi.fn<GitPort["changedSince"]>(),
  contentInBase: vi.fn<GitPort["contentInBase"]>(),
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
});

const fileText = (): VersionOneCheckInput["fileText"] => ({
  read: vi.fn<VersionOneCheckInput["fileText"]["read"]>(),
  exists: vi.fn<VersionOneCheckInput["fileText"]["exists"]>(),
});

const exceptions = (): ExceptionRepository => ({
  read: vi.fn<ExceptionRepository["read"]>().mockReturnValue({ outcome: "ok", value: [PLACED] }),
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
  add: vi.fn<ExceptionRepository["add"]>(),
  remove: vi.fn<ExceptionRepository["remove"]>(),
  moveToSplitLayout: vi.fn<ExceptionRepository["moveToSplitLayout"]>(),
});

describe("foundTreeCheckReachOf", () => {
  it("gives a version 1 check the tree the upgrade found as its base revision, git that tracks only what git tracks, and entries at the base", () => {
    const underlyingGit = git();
    const underlyingExceptions = exceptions();
    const reach = foundTreeCheckReachOf({
      check: {
        git: underlyingGit,
        fileText: fileText(),
        path: PATH,
        exceptionRepository: underlyingExceptions,
      },
      loadFailureDetail,
    });
    expect({
      baseRevision: reach.baseRevision,
      changedSince: reach.git.changedSince({
        repoRoot: REPO_ROOT,
        baseRevision: FOUND_TREE_REVISION,
      }),
      entriesAtBase: reach.exceptionRepository.readAt({ revision: FOUND_TREE_REVISION }),
      tracked: reach.git.trackedPaths({ repoRoot: REPO_ROOT }),
      askedGit: [
        vi.mocked(underlyingGit.changedSince).mock.calls,
        vi.mocked(underlyingExceptions.readAt).mock.calls,
      ],
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changedSince: { outcome: "ok", value: [] },
      entriesAtBase: { outcome: "ok", value: [ENTRY] },
      tracked: { outcome: "ok", value: [TRACKED] },
      askedGit: [[], []],
    });
  });
});

const FOUND_RECORDS_SOURCE: RecordsSource = {
  read: vi.fn<RecordsSource["read"]>(),
  readAt: vi
    .fn<RecordsSource["readAt"]>()
    .mockReturnValue({ outcome: "ok", value: [AUTHORISED_DOCUMENT] }),
};

describe("foundTreeRunReachOf", () => {
  it("gives a version 2 run the tree the upgrade found as its base revision, git that tracks the files the upgrade wrote, and records at the base made from the working tree's entries", () => {
    const underlyingSource: RecordsSource = {
      read: vi.fn<RecordsSource["read"]>(),
      readAt: vi.fn<RecordsSource["readAt"]>(),
    };
    const underlyingGit = git();
    const directory: Pick<DirectoryPort, "list"> = { list: vi.fn<DirectoryPort["list"]>() };
    const gitTree: GitTreePort = { pathsAt: vi.fn<GitTreePort["pathsAt"]>() };
    const underlyingExceptions = exceptions();
    const recordsSourceOf = vi.fn<RecordsSourceOf>().mockReturnValue(underlyingSource);
    const foundTreeRecordsSourceOf = vi
      .fn<FoundTreeRecordsSourceOf>()
      .mockReturnValue(() => FOUND_RECORDS_SOURCE);
    const reach = foundTreeRunReachOf({
      written: [WRITTEN],
      recordsSourceOf,
      foundTreeRecordsSourceOf,
      loadFailureDetail,
      command: {
        git: underlyingGit,
        fileText: fileText(),
        path: PATH,
        exceptionRepositoryOf: () => underlyingExceptions,
      },
    });
    const folder = {
      fileText: fileText(),
      path: PATH,
      directory,
      git: underlyingGit,
      gitTree,
      repoRoot: REPO_ROOT,
      catalogue: SETTINGS_CATALOGUE,
    };
    const recordsAtBase = reach.recordsSourceOf(folder).readAt({ revision: FOUND_TREE_REVISION });
    const [[handed]] = foundTreeRecordsSourceOf.mock.calls;
    expect({
      baseRevision: reach.baseRevision,
      changedSince: reach.git.changedSince({
        repoRoot: REPO_ROOT,
        baseRevision: FOUND_TREE_REVISION,
      }),
      recordsAtBase,
      tracked: reach.git.trackedPaths({ repoRoot: REPO_ROOT }),
      handedOver: {
        recordsSourceOf: handed.recordsSourceOf,
        entriesAtBase: handed.exceptionsOf({ repoRoot: REPO_ROOT }).readAt(),
      },
      askedRecords: vi.mocked(underlyingSource.readAt).mock.calls,
      askedEntries: vi.mocked(underlyingExceptions.readAt).mock.calls,
    }).toEqual({
      baseRevision: FOUND_TREE_REVISION,
      changedSince: { outcome: "ok", value: [] },
      recordsAtBase: { outcome: "ok", value: [AUTHORISED_DOCUMENT] },
      tracked: { outcome: "ok", value: [TRACKED, WRITTEN] },
      handedOver: { recordsSourceOf, entriesAtBase: { outcome: "ok", value: [ENTRY] } },
      askedRecords: [],
      askedEntries: [],
    });
  });
});
