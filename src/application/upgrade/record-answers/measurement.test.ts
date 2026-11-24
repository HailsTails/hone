import { describe, expect, it, vi } from "vitest";

import type { ExceptionBaseline } from "../../../domain/records/discipline-exceptions/exception-baseline.ts";
import type { StructuralExceptionEntry } from "../../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import type {
  LegacyWhyChain,
  VersionOneWhyChain,
} from "../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import type { GitFailure } from "../../../domain/repository/git-failure.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../domain/repository/repo-path-types.ts";
import type { TouchedSet } from "../../../domain/repository/touched-set.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import type { GitPort } from "../../ports/git-port.ts";
import type { ExceptionEntryParser } from "../../ports/records/exception-entries.ts";
import type { ExceptionRepository } from "../../ports/records/exception-repository.ts";
import {
  baselineAtBase,
  baselineNeedOf,
  changeSetNeedOf,
  exceptionBaselineOf,
  partialAssessmentsOf,
  touchedSetFor,
  unmeasuredOf,
} from "./measurement.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const LEGACY_WHY = {
  why: "why is the exception taken",
  because: "the matcher cannot express the tracker id",
  evidence: "tools/why-chain-check.ts:9",
};

const LEGACY_WHY_CHAIN: LegacyWhyChain = {
  whys: [LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY, LEGACY_WHY],
  rootCause: "the audit's matcher predates the tracker id format",
  owner: "capture 01a0b421",
};

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const CLASS_SYNTAX = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};

const AUDIT = "walker" as const;

const LEGACY_FILE = repoPathOf("src/legacy.ts");

const LEGACY_SOURCE_FILE = repoPathOf(".constitution-authorised-locations/cd-14.json");

const FILE_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: LEGACY_FILE,
  reason: "legacy class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const REASON_ONLY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: LEGACY_FILE,
  reason: "legacy class awaiting paydown",
};

const AUTHORISED_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathOf("src/factory.ts"),
  reason: "the wrapping factory for the library",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const REASON_ONLY_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathOf("src/factory.ts"),
  reason: "the wrapping factory for the library",
};

const IMPORTED_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathOf("src/factory.ts"),
  reason: "the wrapping factory for the library",
  provenance: {
    kind: "existing-authorisation",
    source: ".constitution-authorised-locations/cd-14.json#0",
  },
};

const LEGACY_CHAIN_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  file: repoPathOf("src/factory.ts"),
  reason: "the wrapping factory for the library",
  whyChain: LEGACY_WHY_CHAIN,
};

const CLAUSE_WIDE_CARVE_OUT: ExceptionRecord = {
  kind: "clause-wide-carve-out",
  clause: CLASS_SYNTAX,
  mechanism: AUDIT,
  reason: "class syntax carved out during migration",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const CARVE_OUT_ENTRY: StructuralExceptionEntry = {
  kind: "file-carve-out",
  clause: "CD-14#class-syntax",
  file: "src/legacy.ts",
  reason: "legacy class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const REASON_ONLY_LOCATION_ENTRY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
};

const IMPORTED_LOCATION_ENTRY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
  provenance: {
    kind: "existing-authorisation",
    source: ".constitution-authorised-locations/cd-14.json#0",
  },
};

const LEGACY_CHAIN_ENTRY: StructuralExceptionEntry = {
  kind: "authorised-location",
  clause: "CD-14#class-syntax",
  file: "src/factory.ts",
  reason: "the wrapping factory for the library",
  whyChain: LEGACY_WHY_CHAIN,
};

const GIT_FAILURE: GitFailure = {
  kind: "git-failed",
  command: "git ls-tree",
  detail: "fatal: not a tree object",
};

const SOURCE_FAILURE: GitFailure = {
  kind: "git-failed",
  command: "git show",
  detail: "fatal: bad object main:cd-14.json",
};

const UNMEASURED_NOT_GIVEN = { measured: "no", base: { state: "not-given" } } as const;

const UNMEASURED_GIT_FAILED = {
  measured: "no",
  base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
} as const;

const MEASURED_NOTHING_TOUCHED: TouchedSet = { measured: "yes", paths: new Set() };

const MEASURED_BASELINE: ExceptionBaseline = {
  measured: "yes",
  entriesAtBase: [],
  sourceTextsAtBase: new Map(),
  basePathOfRenamed: new Map(),
};

const changedSinceAnswering = (
  answer: ReturnType<GitPort["changedSince"]>,
): Pick<GitPort, "changedSince"> => ({
  changedSince: vi.fn<GitPort["changedSince"]>().mockReturnValue(answer),
});

const UNASKED_CHANGE_SET: Pick<GitPort, "changedSince"> = {
  changedSince: vi.fn<GitPort["changedSince"]>(),
};

const NO_RENAMES: ReturnType<GitPort["renamedSince"]> = { outcome: "ok", value: new Map() };

const baseGitAnswering = (answers: {
  readonly text: ReturnType<GitPort["textInBase"]>;
  readonly renames: ReturnType<GitPort["renamedSince"]>;
}): Pick<GitPort, "textInBase" | "renamedSince"> => ({
  textInBase: vi.fn<GitPort["textInBase"]>().mockReturnValue(answers.text),
  renamedSince: vi.fn<GitPort["renamedSince"]>().mockReturnValue(answers.renames),
});

const UNASKED_BASE_GIT: Pick<GitPort, "textInBase" | "renamedSince"> = {
  textInBase: vi.fn<GitPort["textInBase"]>(),
  renamedSince: vi.fn<GitPort["renamedSince"]>(),
};

const exceptionRepositoryAnswering = (
  answer: ReturnType<ExceptionRepository["readAt"]>,
): Pick<ExceptionRepository, "readAt"> => ({
  readAt: vi.fn<ExceptionRepository["readAt"]>().mockReturnValue(answer),
});

const UNASKED_REPOSITORY: Pick<ExceptionRepository, "readAt"> = {
  readAt: vi.fn<ExceptionRepository["readAt"]>(),
};

describe("unmeasuredOf", () => {
  it("lists forfeiture-unmeasured when no base revision is given and a file carve-out exists", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_NOT_GIVEN,
        exceptionBaseline: MEASURED_BASELINE,
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual([{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists forfeiture-unmeasured with git's message when git cannot measure the change set and a file carve-out exists", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_GIT_FAILED,
        exceptionBaseline: MEASURED_BASELINE,
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual([
      {
        kind: "forfeiture-unmeasured",
        base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
      },
    ]);
  });

  it("lists forfeiture-unmeasured for a reason-only file carve-out", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_NOT_GIVEN,
        exceptionBaseline: MEASURED_BASELINE,
        records: [REASON_ONLY_CARVE_OUT],
      }),
    ).toEqual([{ kind: "forfeiture-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists nothing when the change set is unmeasured and no file carve-out exists", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_NOT_GIVEN,
        exceptionBaseline: MEASURED_BASELINE,
        records: [AUTHORISED_LOCATION, REASON_ONLY_LOCATION, CLAUSE_WIDE_CARVE_OUT],
      }),
    ).toEqual([]);
  });

  it("lists nothing when the change set is measured and a file carve-out exists", () => {
    expect(
      unmeasuredOf({
        touched: MEASURED_NOTHING_TOUCHED,
        exceptionBaseline: MEASURED_BASELINE,
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual([]);
  });

  it("lists no forfeiture-unmeasured when forfeiture is assessed elsewhere", () => {
    expect(
      unmeasuredOf({
        touched: { measured: "elsewhere" },
        exceptionBaseline: MEASURED_BASELINE,
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual([]);
  });

  it("lists import-unmeasured when the exception baseline is unmeasured and an imported record exists", () => {
    expect(
      unmeasuredOf({
        touched: MEASURED_NOTHING_TOUCHED,
        exceptionBaseline: UNMEASURED_GIT_FAILED,
        records: [IMPORTED_LOCATION],
      }),
    ).toEqual([
      {
        kind: "import-unmeasured",
        base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
      },
    ]);
  });

  it("lists legacy-chain-unmeasured when the exception baseline is unmeasured and a record holds a legacy chain", () => {
    expect(
      unmeasuredOf({
        touched: MEASURED_NOTHING_TOUCHED,
        exceptionBaseline: UNMEASURED_NOT_GIVEN,
        records: [LEGACY_CHAIN_LOCATION],
      }),
    ).toEqual([{ kind: "legacy-chain-unmeasured", base: { state: "not-given" } }]);
  });

  it("lists no import or legacy-chain kind when the exception baseline is measured", () => {
    expect(
      unmeasuredOf({
        touched: MEASURED_NOTHING_TOUCHED,
        exceptionBaseline: MEASURED_BASELINE,
        records: [IMPORTED_LOCATION, LEGACY_CHAIN_LOCATION],
      }),
    ).toEqual([]);
  });

  it("lists forfeiture, import and legacy-chain unmeasured together, in that order", () => {
    expect(
      unmeasuredOf({
        touched: UNMEASURED_NOT_GIVEN,
        exceptionBaseline: UNMEASURED_NOT_GIVEN,
        records: [LEGACY_CHAIN_LOCATION, IMPORTED_LOCATION, FILE_CARVE_OUT],
      }),
    ).toEqual([
      { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
      { kind: "import-unmeasured", base: { state: "not-given" } },
      { kind: "legacy-chain-unmeasured", base: { state: "not-given" } },
    ]);
  });

  it("lists import and legacy-chain unmeasured when forfeiture is assessed elsewhere", () => {
    expect(
      unmeasuredOf({
        touched: { measured: "elsewhere" },
        exceptionBaseline: UNMEASURED_GIT_FAILED,
        records: [IMPORTED_LOCATION, LEGACY_CHAIN_LOCATION, FILE_CARVE_OUT],
      }),
    ).toEqual([
      {
        kind: "import-unmeasured",
        base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
      },
      {
        kind: "legacy-chain-unmeasured",
        base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
      },
    ]);
  });
});

describe("changeSetNeedOf", () => {
  it("needs the change set since the base when a file carve-out exists and forfeiture is assessed in this run", () => {
    expect(
      changeSetNeedOf({ assessment: { forfeiture: "this-run" }, records: [FILE_CARVE_OUT] }),
    ).toEqual({ kind: "measure-since-base" });
  });

  it("settles on nothing touched when no file carve-out exists", () => {
    expect(
      changeSetNeedOf({
        assessment: { forfeiture: "this-run" },
        records: [AUTHORISED_LOCATION, CLAUSE_WIDE_CARVE_OUT],
      }),
    ).toEqual({ kind: "settled", touched: { measured: "yes", paths: new Set() } });
  });

  it("settles on elsewhere when forfeiture is assessed elsewhere, even with a file carve-out", () => {
    expect(
      changeSetNeedOf({ assessment: { forfeiture: "elsewhere" }, records: [FILE_CARVE_OUT] }),
    ).toEqual({
      kind: "settled",
      touched: { measured: "elsewhere" },
    });
  });
});

describe("touchedSetFor", () => {
  it("asks git for the change set since the check's base revision under its root when it is needed", () => {
    const git = changedSinceAnswering({ outcome: "ok", value: [LEGACY_FILE] });
    expect({
      touched: touchedSetFor({
        check: {
          assessment: { forfeiture: "this-run" },
          repoRoot: REPO_ROOT,
          baseRevision: "main",
          git,
        },
        records: [FILE_CARVE_OUT],
      }),
      changedSince: vi.mocked(git.changedSince).mock.calls,
    }).toEqual({
      touched: { measured: "yes", paths: new Set([LEGACY_FILE]) },
      changedSince: [[{ repoRoot: REPO_ROOT, baseRevision: "main" }]],
    });
  });

  it("is unmeasured when the change set is needed and no base revision is given", () => {
    expect(
      touchedSetFor({
        check: {
          assessment: { forfeiture: "this-run" },
          repoRoot: REPO_ROOT,
          baseRevision: undefined,
          git: UNASKED_CHANGE_SET,
        },
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual({ measured: "no", base: { state: "not-given" } });
  });

  it("is the settled answer when the change set is not needed", () => {
    expect(
      touchedSetFor({
        check: {
          assessment: { forfeiture: "elsewhere" },
          repoRoot: REPO_ROOT,
          baseRevision: "main",
          git: UNASKED_CHANGE_SET,
        },
        records: [FILE_CARVE_OUT],
      }),
    ).toEqual({ measured: "elsewhere" });
  });
});

describe("partialAssessmentsOf", () => {
  it("reports the file carve-outs it did not check for decay when forfeiture is assessed elsewhere", () => {
    expect(
      partialAssessmentsOf({
        assessment: { forfeiture: "elsewhere" },
        records: [
          FILE_CARVE_OUT,
          AUTHORISED_LOCATION,
          REASON_ONLY_CARVE_OUT,
          CLAUSE_WIDE_CARVE_OUT,
        ],
      }),
    ).toEqual([{ concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 2 }]);
  });

  it("reports forfeiture elsewhere with no file carve-outs when none exists", () => {
    expect(
      partialAssessmentsOf({
        assessment: { forfeiture: "elsewhere" },
        records: [AUTHORISED_LOCATION],
      }),
    ).toEqual([{ concern: "forfeiture", assessedBy: "elsewhere", fileCarveOuts: 0 }]);
  });

  it("reports no assessment when forfeiture is assessed in this run", () => {
    expect(
      partialAssessmentsOf({ assessment: { forfeiture: "this-run" }, records: [FILE_CARVE_OUT] }),
    ).toEqual([]);
  });
});

const entriesReaderFinding = (request: {
  readonly imported: "present" | "absent";
  readonly sources: readonly RepoPath[];
}): Pick<ExceptionEntryParser, "importedEntriesIn" | "importSourcesOf"> => ({
  importedEntriesIn: vi
    .fn<ExceptionEntryParser["importedEntriesIn"]>()
    .mockReturnValue(request.imported),
  importSourcesOf: vi
    .fn<ExceptionEntryParser["importSourcesOf"]>()
    .mockReturnValue(request.sources),
});

const NOTHING_IMPORTED = entriesReaderFinding({ imported: "absent", sources: [] });

describe("baselineNeedOf", () => {
  it("settles on unmeasured when no base revision is given", () => {
    expect(
      baselineNeedOf({
        exceptionEntryParser: entriesReaderFinding({
          imported: "present",
          sources: [LEGACY_SOURCE_FILE],
        }),
        baseRevision: undefined,
        entries: [IMPORTED_LOCATION_ENTRY, LEGACY_CHAIN_ENTRY],
      }),
    ).toEqual({
      kind: "settled",
      baseline: UNMEASURED_NOT_GIVEN,
    });
  });

  it("settles on unmeasured when no entry is imported or holds a legacy chain", () => {
    expect(
      baselineNeedOf({
        exceptionEntryParser: NOTHING_IMPORTED,
        baseRevision: "main",
        entries: [CARVE_OUT_ENTRY, REASON_ONLY_LOCATION_ENTRY],
      }),
    ).toEqual({
      kind: "settled",
      baseline: UNMEASURED_NOT_GIVEN,
    });
  });

  it("needs the records at the base and only the imported entries' sources", () => {
    const exceptionEntryParser = entriesReaderFinding({
      imported: "present",
      sources: [LEGACY_SOURCE_FILE],
    });
    expect({
      need: baselineNeedOf({
        exceptionEntryParser,
        baseRevision: "main",
        entries: [IMPORTED_LOCATION_ENTRY, CARVE_OUT_ENTRY],
      }),
      sourcesAskedOf: vi.mocked(exceptionEntryParser.importSourcesOf).mock.calls,
    }).toEqual({
      need: { kind: "read-at-base", baseRevision: "main", sources: [LEGACY_SOURCE_FILE] },
      sourcesAskedOf: [[{ entries: [IMPORTED_LOCATION_ENTRY, CARVE_OUT_ENTRY] }]],
    });
  });

  it("needs the records at the base and no source for a legacy chain", () => {
    expect(
      baselineNeedOf({
        exceptionEntryParser: NOTHING_IMPORTED,
        baseRevision: "main",
        entries: [LEGACY_CHAIN_ENTRY],
      }),
    ).toEqual({
      kind: "read-at-base",
      baseRevision: "main",
      sources: [],
    });
  });
});

describe("baselineAtBase", () => {
  it("reads the records, each source and the renames since the base revision, keeping the sources present there", () => {
    const git = baseGitAnswering({
      text: { outcome: "ok", value: { presence: "present-in-base", text: "[]" } },
      renames: {
        outcome: "ok",
        value: new Map([
          [repoPathOf("src/moved/legacy.ts"), { basePath: LEGACY_FILE, content: "edited" }],
        ]),
      },
    });
    const exceptionRepository = exceptionRepositoryAnswering({
      outcome: "ok",
      value: [CARVE_OUT_ENTRY],
    });
    expect({
      baseline: baselineAtBase({
        reach: { repoRoot: REPO_ROOT, git, exceptionRepository },
        baseRevision: "main",
        sources: [LEGACY_SOURCE_FILE],
      }),
      readAt: vi.mocked(exceptionRepository.readAt).mock.calls,
      textInBase: vi.mocked(git.textInBase).mock.calls,
      renamedSince: vi.mocked(git.renamedSince).mock.calls,
    }).toEqual({
      baseline: {
        measured: "yes",
        entriesAtBase: [CARVE_OUT_ENTRY],
        sourceTextsAtBase: new Map([[LEGACY_SOURCE_FILE, "[]"]]),
        basePathOfRenamed: new Map([
          ["src/moved/legacy.ts", { basePath: "src/legacy.ts", content: "edited" }],
        ]),
      },
      readAt: [[{ revision: "main" }]],
      textInBase: [[{ repoRoot: REPO_ROOT, baseRevision: "main", file: LEGACY_SOURCE_FILE }]],
      renamedSince: [[{ repoRoot: REPO_ROOT, baseRevision: "main" }]],
    });
  });

  it("leaves out a source the base does not hold", () => {
    expect(
      baselineAtBase({
        reach: {
          repoRoot: REPO_ROOT,
          git: baseGitAnswering({
            text: { outcome: "ok", value: { presence: "absent-from-base" } },
            renames: NO_RENAMES,
          }),
          exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [] }),
        },
        baseRevision: "main",
        sources: [LEGACY_SOURCE_FILE],
      }),
    ).toEqual({
      measured: "yes",
      entriesAtBase: [],
      sourceTextsAtBase: new Map(),
      basePathOfRenamed: new Map(),
    });
  });

  it("is measured from the records and renames alone when there is no source to read", () => {
    const git: Pick<GitPort, "textInBase" | "renamedSince"> = {
      textInBase: vi.fn<GitPort["textInBase"]>(),
      renamedSince: vi.fn<GitPort["renamedSince"]>().mockReturnValue(NO_RENAMES),
    };
    expect({
      baseline: baselineAtBase({
        reach: {
          repoRoot: REPO_ROOT,
          git,
          exceptionRepository: exceptionRepositoryAnswering({
            outcome: "ok",
            value: [LEGACY_CHAIN_ENTRY],
          }),
        },
        baseRevision: "main",
        sources: [],
      }),
      textInBase: vi.mocked(git.textInBase).mock.calls,
    }).toEqual({
      baseline: {
        measured: "yes",
        entriesAtBase: [LEGACY_CHAIN_ENTRY],
        sourceTextsAtBase: new Map(),
        basePathOfRenamed: new Map(),
      },
      textInBase: [],
    });
  });

  it("is unmeasured with git's message when the records at the base cannot be read", () => {
    expect(
      baselineAtBase({
        reach: {
          repoRoot: REPO_ROOT,
          git: baseGitAnswering({
            text: { outcome: "ok", value: { presence: "absent-from-base" } },
            renames: NO_RENAMES,
          }),
          exceptionRepository: exceptionRepositoryAnswering({
            outcome: "failed",
            error: GIT_FAILURE,
          }),
        },
        baseRevision: "main",
        sources: [LEGACY_SOURCE_FILE],
      }),
    ).toEqual(UNMEASURED_GIT_FAILED);
  });

  it("is unmeasured with git's message when a source cannot be read at the base", () => {
    expect(
      baselineAtBase({
        reach: {
          repoRoot: REPO_ROOT,
          git: baseGitAnswering({
            text: { outcome: "failed", error: SOURCE_FAILURE },
            renames: NO_RENAMES,
          }),
          exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [] }),
        },
        baseRevision: "main",
        sources: [LEGACY_SOURCE_FILE],
      }),
    ).toEqual({
      measured: "no",
      base: {
        state: "git-failed",
        revision: "main",
        gitMessage: "fatal: bad object main:cd-14.json",
      },
    });
  });

  it("is unmeasured with git's message when the renames since the base cannot be read", () => {
    expect(
      baselineAtBase({
        reach: {
          repoRoot: REPO_ROOT,
          git: baseGitAnswering({
            text: { outcome: "ok", value: { presence: "present-in-base", text: "[]" } },
            renames: {
              outcome: "failed",
              error: {
                kind: "git-failed",
                command: "git diff",
                detail: "fatal: bad revision 'main'",
              },
            },
          }),
          exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [] }),
        },
        baseRevision: "main",
        sources: [LEGACY_SOURCE_FILE],
      }),
    ).toEqual({
      measured: "no",
      base: { state: "git-failed", revision: "main", gitMessage: "fatal: bad revision 'main'" },
    });
  });

  it("reports the records' failure, not a source's, when both cannot be read at the base", () => {
    expect(
      baselineAtBase({
        reach: {
          repoRoot: REPO_ROOT,
          git: baseGitAnswering({
            text: { outcome: "failed", error: SOURCE_FAILURE },
            renames: NO_RENAMES,
          }),
          exceptionRepository: exceptionRepositoryAnswering({
            outcome: "failed",
            error: GIT_FAILURE,
          }),
        },
        baseRevision: "main",
        sources: [LEGACY_SOURCE_FILE],
      }),
    ).toEqual(UNMEASURED_GIT_FAILED);
  });
});

describe("exceptionBaselineOf", () => {
  it("is the baseline read at the base revision when one is needed", () => {
    expect(
      exceptionBaselineOf({
        check: {
          repoRoot: REPO_ROOT,
          baseRevision: "main",
          git: baseGitAnswering({
            text: { outcome: "ok", value: { presence: "present-in-base", text: "[]" } },
            renames: NO_RENAMES,
          }),
          exceptionRepository: exceptionRepositoryAnswering({ outcome: "ok", value: [] }),
          exceptionEntryParser: entriesReaderFinding({
            imported: "present",
            sources: [LEGACY_SOURCE_FILE],
          }),
        },
        entries: [IMPORTED_LOCATION_ENTRY],
      }),
    ).toEqual({
      measured: "yes",
      entriesAtBase: [],
      sourceTextsAtBase: new Map([[LEGACY_SOURCE_FILE, "[]"]]),
      basePathOfRenamed: new Map(),
    });
  });

  it("is the settled baseline when none is needed", () => {
    expect(
      exceptionBaselineOf({
        check: {
          repoRoot: REPO_ROOT,
          baseRevision: undefined,
          git: UNASKED_BASE_GIT,
          exceptionRepository: UNASKED_REPOSITORY,
          exceptionEntryParser: NOTHING_IMPORTED,
        },
        entries: [IMPORTED_LOCATION_ENTRY, LEGACY_CHAIN_ENTRY],
      }),
    ).toEqual(UNMEASURED_NOT_GIVEN);
  });
});
