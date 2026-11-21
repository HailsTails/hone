import { assert, describe, expect, it, vi } from "vitest";
import type { LoadFailure } from "../../domain/report/load-failure.ts";
import { createDefaultFileTextPort } from "../node/file-system/file-text-port.ts";
import { createDefaultPathPort, createPathPort, type PathPort } from "../node/path-port.ts";
import type { ClauseDefinition, ClauseSettingDeclarations, DisciplineFile, PieceFile } from "../../domain/rule-set/rule-set-types.ts";
import { absolutePathSchema } from "../content-files/absolute-path.ts";
import { clauseEditionsSchema } from "../content-files/edition.ts";
import { clauseIdSchema, disciplineIdSchema, mechanismIdSchema, ruleSetNameSchema } from "../hone-config-file/identifiers.ts";
import type { MechanismId } from "../../domain/rule-set/identifier-types.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import {
  createSelectionRepository,
  readRunSettings,
  ruleSetRootOf,
  selectionFrom,
} from "./consumer-selection.ts";
import type { Held, RuleSetFiles } from "../content-files/rule-sets/rule-set-files.ts";
import { selectionFileOf } from "./selection-file.ts";
import type { ConsumerSelectionFile, RuleSetLocation } from "../../domain/settings/selection/selection-file.ts";

const REPO_ROOT = absolutePathSchema.parse("/repo");
const INSTALL_ROOT = absolutePathSchema.parse("/install");
const SELECTION_PATH = "/repo/disciplines.json";

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const AUDIT = mechanismIdSchema.parse("audit");
const OXLINT = mechanismIdSchema.parse("oxlint");
const ESLINT = mechanismIdSchema.parse("eslint");

const ONE_EDITION = clauseEditionsSchema.parse(undefined);
const EDITIONS_ONE_AND_TWO = clauseEditionsSchema.parse(["1", "2"]);
const NO_DECLARATIONS: ClauseSettingDeclarations = {};

const mechanical = (request: {
  readonly id: string;
  readonly mechanisms: readonly MechanismId[];
  readonly keyword: string;
}): ClauseDefinition => ({
  kind: "mechanical",
  id: clauseIdSchema.parse(request.id),
  summary: "a mechanical clause",
  mechanisms: request.mechanisms,
  anchor: { kind: "keyword", keyword: request.keyword },
  exceptions: "allowed",
  cases: { flag: [], allow: [] },
});

const auditClause = (id: string): ClauseDefinition => mechanical({ id, mechanisms: [AUDIT], keyword: "class" });

const LIBRARY_CONSTRUCTION: ClauseDefinition = {
  kind: "judgement",
  id: clauseIdSchema.parse("library-construction"),
  summary: "wrap libraries",
  enforcedBy: "review",
};

const disciplineFile = (request: { readonly id: string; readonly clauses: readonly ClauseDefinition[] }): DisciplineFile => ({
  version: 1,
  id: disciplineIdSchema.parse(request.id),
  clauses: request.clauses,
});

const pieceFile = (request: {
  readonly discipline: string;
  readonly mechanism: MechanismId;
  readonly clauses: PieceFile["clauses"];
}): PieceFile => ({
  version: 1,
  discipline: disciplineIdSchema.parse(request.discipline),
  mechanism: request.mechanism,
  clauses: request.clauses,
});

const pieceClause = (request: {
  readonly clause: string;
  readonly settings: unknown;
  readonly clauseSettings: ClauseSettingDeclarations;
  readonly editions: PieceFile["clauses"][number]["editions"];
}): PieceFile["clauses"][number] => ({
  clause: clauseIdSchema.parse(request.clause),
  settings: request.settings,
  clauseSettings: request.clauseSettings,
  editions: request.editions,
});

const moduleClause = (request: { readonly clause: string; readonly module: string }) =>
  pieceClause({
    clause: request.clause,
    settings: { module: request.module },
    clauseSettings: NO_DECLARATIONS,
    editions: ONE_EDITION,
  });

const CD_14 = disciplineFile({ id: "CD-14", clauses: [auditClause("class-syntax"), auditClause("abstract-syntax"), LIBRARY_CONSTRUCTION] });

const CD_14_WITH_THREE_MECHANICAL = disciplineFile({
  id: "CD-14",
  clauses: [auditClause("class-syntax"), auditClause("abstract-syntax"), auditClause("decorator-syntax"), LIBRARY_CONSTRUCTION],
});

const CD_14_PIECE = pieceFile({
  discipline: "CD-14",
  mechanism: AUDIT,
  clauses: [
    moduleClause({ clause: "class-syntax", module: "class-syntax.ts" }),
    moduleClause({ clause: "abstract-syntax", module: "abstract-syntax.ts" }),
  ],
});

const CD_14_ON_TWO_MECHANISMS = disciplineFile({
  id: "CD-14",
  clauses: [
    mechanical({ id: "class-syntax", mechanisms: [AUDIT, OXLINT], keyword: "class" }),
    mechanical({ id: "abstract-syntax", mechanisms: [AUDIT, OXLINT], keyword: "class" }),
  ],
});

const CD_14_OXLINT_PIECE = pieceFile({
  discipline: "CD-14",
  mechanism: OXLINT,
  clauses: [pieceClause({ clause: "abstract-syntax", settings: { rule: "no-abstract" }, clauseSettings: NO_DECLARATIONS, editions: ONE_EDITION })],
});

const CD_14_WITHOUT_CLASS_SYNTAX_PIECE = pieceFile({
  discipline: "CD-14",
  mechanism: AUDIT,
  clauses: [moduleClause({ clause: "abstract-syntax", module: "abstract-syntax.ts" })],
});

const TEAM_CD_14 = disciplineFile({
  id: "CD-14",
  clauses: [mechanical({ id: "class-syntax", mechanisms: [AUDIT], keyword: "enum" })],
});

const TEAM_CD_14_PIECE = pieceFile({
  discipline: "CD-14",
  mechanism: AUDIT,
  clauses: [moduleClause({ clause: "class-syntax", module: "team-class-syntax.ts" })],
});

const TM_1 = disciplineFile({ id: "TM-1", clauses: [auditClause("no-tmp-files")] });

const TM_1_PIECE = pieceFile({
  discipline: "TM-1",
  mechanism: AUDIT,
  clauses: [moduleClause({ clause: "no-tmp-files", module: "no-tmp-files.ts" })],
});

const CD_14_SETTABLE_PIECE = pieceFile({
  discipline: "CD-14",
  mechanism: AUDIT,
  clauses: [
    pieceClause({
      clause: "class-syntax",
      settings: { module: "class-syntax.ts" },
      clauseSettings: { allowedNames: { default: [] }, style: { default: "plain", choices: ["plain", "strict"] } },
      editions: ONE_EDITION,
    }),
    moduleClause({ clause: "abstract-syntax", module: "abstract-syntax.ts" }),
  ],
});

const CD_14_EDITIONED_PIECE = pieceFile({
  discipline: "CD-14",
  mechanism: AUDIT,
  clauses: [
    pieceClause({
      clause: "class-syntax",
      settings: { module: "class-syntax.ts" },
      clauseSettings: { style: { default: "plain", choices: ["plain", "strict"] } },
      editions: EDITIONS_ONE_AND_TWO,
    }),
    moduleClause({ clause: "abstract-syntax", module: "abstract-syntax.ts" }),
  ],
});

const CD_6 = disciplineFile({ id: "CD-6", clauses: [mechanical({ id: "naming-convention", mechanisms: [ESLINT], keyword: "class" })] });

const CD_6_PIECE = pieceFile({
  discipline: "CD-6",
  mechanism: ESLINT,
  clauses: [pieceClause({ clause: "naming-convention", settings: {}, clauseSettings: NO_DECLARATIONS, editions: ONE_EDITION })],
});

const TD_1 = disciplineFile({ id: "TD-1", clauses: [auditClause("x")] });

const TD_1_PIECE = pieceFile({
  discipline: "TD-1",
  mechanism: AUDIT,
  clauses: [
    pieceClause({ clause: "x", settings: { module: "x.ts" }, clauseSettings: { limit: { default: 3 } }, editions: ONE_EDITION }),
  ],
});

type FileRead<File> = Result<Held<File>, LoadFailure>;

const present = <File>(file: File): FileRead<File> => ({ outcome: "ok", value: { held: "present", file } });

const ABSENT: FileRead<never> = { outcome: "ok", value: { held: "absent" } };

const disciplineReads = (first: FileRead<DisciplineFile>, second: FileRead<DisciplineFile> = first) =>
  vi.fn<RuleSetFiles["discipline"]>().mockReturnValueOnce(first).mockReturnValueOnce(second);

const pieceReads = (first: FileRead<PieceFile>, second: FileRead<PieceFile> = first) =>
  vi.fn<RuleSetFiles["piece"]>().mockReturnValueOnce(first).mockReturnValueOnce(second);

const rulesReturning = (request: {
  readonly disciplines: readonly [FileRead<DisciplineFile>, FileRead<DisciplineFile>?];
  readonly pieces: readonly [FileRead<PieceFile>, FileRead<PieceFile>?];
  readonly runner: "present" | "absent";
}) => {
  const [firstDiscipline, secondDiscipline] = request.disciplines;
  const [firstPiece, secondPiece] = request.pieces;
  return {
    discipline: disciplineReads(firstDiscipline, secondDiscipline),
    piece: pieceReads(firstPiece, secondPiece),
    runner: vi.fn<RuleSetFiles["runner"]>().mockReturnValue(request.runner),
  };
};

const installRules = () => rulesReturning({ disciplines: [present(CD_14)], pieces: [present(CD_14_PIECE)], runner: "present" });

const settableRules = () => rulesReturning({ disciplines: [present(CD_14)], pieces: [present(CD_14_SETTABLE_PIECE)], runner: "present" });

const editionedRules = () => rulesReturning({ disciplines: [present(CD_14)], pieces: [present(CD_14_EDITIONED_PIECE)], runner: "present" });

const listingRules = (first: FileRead<DisciplineFile>, second: FileRead<DisciplineFile> = first) => ({
  discipline: disciplineReads(first, second),
  piece: vi.fn<RuleSetFiles["piece"]>(),
  runner: vi.fn<RuleSetFiles["runner"]>().mockReturnValue("absent"),
});

const fileOf = (document: unknown): ConsumerSelectionFile => {
  const parsed = selectionFileOf({ document, path: SELECTION_PATH });
  assert(parsed.outcome === "ok", "the selection document is well formed");
  return parsed.value;
};

const selectionOver = (ruleSetFiles: RuleSetFiles, document: unknown) =>
  selectionFrom({
    ruleSetFiles,
    path: POSIX_PATH,
    repoRoot: REPO_ROOT,
    installRoot: INSTALL_ROOT,
    moduleExtension: ".ts",
    file: fileOf(document),
    filePath: SELECTION_PATH,
  });

const withDocument = (clauses: Readonly<Record<string, string>>) => ({ version: 1, ruleSets: {}, clauses });

const HONE_CLASS_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "class-syntax" };
const HONE_ABSTRACT_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "abstract-syntax" };
const HONE_DECORATOR_SYNTAX = { ruleSet: "hone", discipline: "CD-14", clause: "decorator-syntax" };
const TEAM_NO_TMP_FILES = { ruleSet: { name: "team" }, discipline: "TM-1", clause: "no-tmp-files" };

const BOTH_CD_14_CLAUSES = { "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "audit" };

const CLASS_SYNTAX_BINDING = {
  mechanism: "audit",
  clause: {
    address: HONE_CLASS_SYNTAX,
    anchor: { kind: "keyword", keyword: "class" },
    pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
    settings: { module: "class-syntax.ts" },
    clauseSettings: {},
    edition: "1",
  },
};

describe("selectionFrom selecting clauses", () => {
  it("selects a shared and a named clause, rooted at the install and the rule set, with the uncovered clauses", () => {
    const rules = rulesReturning({
      disciplines: [present(CD_14), present(TM_1)],
      pieces: [present(CD_14_PIECE), present(TM_1_PIECE)],
      runner: "present",
    });
    expect(
      selectionOver(rules, {
        version: 1,
        ruleSets: { team: "team-rules" },
        clauses: { "CD-14#class-syntax": "audit", "team/TM-1#no-tmp-files": "audit" },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: HONE_CLASS_SYNTAX, mechanism: "audit", exceptions: "allowed" },
            { address: TEAM_NO_TMP_FILES, mechanism: "audit", exceptions: "allowed" },
          ],
          uncovered: [HONE_ABSTRACT_SYNTAX],
          notAdopted: [],
          notRun: [],
          editions: [],
        },
        bindings: [
          CLASS_SYNTAX_BINDING,
          {
            mechanism: "audit",
            clause: {
              address: TEAM_NO_TMP_FILES,
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/repo/team-rules/mechanisms/audit/TM-1",
              settings: { module: "no-tmp-files.ts" },
              clauseSettings: {},
              edition: "1",
            },
          },
        ],
        eslintConfigRoots: [],
        clauseRoots: [
          { clause: HONE_CLASS_SYNTAX, ruleSetRoot: "/install" },
          { clause: TEAM_NO_TMP_FILES, ruleSetRoot: "/repo/team-rules" },
        ],
        excluded: [],
        fileExceptionWhyChains: "required",
      },
    });
    expect(rules.discipline.mock.calls).toEqual([
      [{ ruleSetRoot: "/install", discipline: "CD-14" }],
      [{ ruleSetRoot: "/repo/team-rules", discipline: "TM-1" }],
    ]);
  });

  it("selects a shared clause, rooted at the install, with its mechanism", () => {
    expect(selectionOver(installRules(), withDocument(BOTH_CD_14_CLAUSES))).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: HONE_CLASS_SYNTAX, mechanism: "audit", exceptions: "allowed" },
            { address: HONE_ABSTRACT_SYNTAX, mechanism: "audit", exceptions: "allowed" },
          ],
          uncovered: [],
          notAdopted: [],
          notRun: [],
          editions: [],
        },
        bindings: [
          CLASS_SYNTAX_BINDING,
          {
            mechanism: "audit",
            clause: {
              address: HONE_ABSTRACT_SYNTAX,
              anchor: { kind: "keyword", keyword: "class" },
              pieceRoot: "/install/src/infrastructure/engines/audit/CD-14",
              settings: { module: "abstract-syntax.ts" },
              clauseSettings: {},
              edition: "1",
            },
          },
        ],
        eslintConfigRoots: [],
        clauseRoots: [
          { clause: HONE_CLASS_SYNTAX, ruleSetRoot: "/install" },
          { clause: HONE_ABSTRACT_SYNTAX, ruleSetRoot: "/install" },
        ],
        excluded: [],
        fileExceptionWhyChains: "required",
      },
    });
  });

  it("selects a hone-prefixed clause as the same bare-addressed hone clause", () => {
    expect(selectionOver(installRules(), withDocument({ "hone/CD-14#class-syntax": "audit" }))).toMatchObject({
      outcome: "ok",
      value: { selection: { selected: [{ address: HONE_CLASS_SYNTAX, mechanism: "audit", exceptions: "allowed" }] } },
    });
  });

  it("carries what the document excludes, the ESLint config roots and the why-chain rule onto the reading", () => {
    expect(
      selectionOver(installRules(), {
        ...withDocument({ "CD-14#class-syntax": "audit" }),
        exclude: ["vendor", "src/generated.ts"],
        eslintConfigRoots: ["packages/a"],
        fileExceptionWhyChains: "optional",
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { excluded: ["vendor", "src/generated.ts"], eslintConfigRoots: ["packages/a"], fileExceptionWhyChains: "optional" },
    });
  });

  it("selects a named rule set's clause from a directory relative to the repo root", () => {
    const rules = rulesReturning({ disciplines: [present(TM_1)], pieces: [present(TM_1_PIECE)], runner: "present" });
    expect(
      selectionOver(rules, { version: 1, ruleSets: { team: "team-rules" }, clauses: { "team/TM-1#no-tmp-files": "audit" } }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        selection: { selected: [{ address: TEAM_NO_TMP_FILES, mechanism: "audit", exceptions: "allowed" }], uncovered: [] },
        bindings: [{ clause: { pieceRoot: "/repo/team-rules/mechanisms/audit/TM-1", settings: { module: "no-tmp-files.ts" } } }],
        clauseRoots: [{ clause: TEAM_NO_TMP_FILES, ruleSetRoot: "/repo/team-rules" }],
      },
    });
  });

  it("roots a named rule set declared as . at the repo root", () => {
    const rules = rulesReturning({ disciplines: [present(TM_1)], pieces: [present(TM_1_PIECE)], runner: "present" });
    expect(
      selectionOver(rules, { version: 1, ruleSets: { team: "." }, clauses: { "team/TM-1#no-tmp-files": "audit" } }),
    ).toMatchObject({
      outcome: "ok",
      value: { bindings: [{ clause: { pieceRoot: "/repo/mechanisms/audit/TM-1" } }] },
    });
    expect(rules.discipline.mock.calls).toEqual([[{ ruleSetRoot: "/repo", discipline: "TM-1" }]]);
  });

  it("lists the unlisted mechanical clauses of an adopted discipline as uncovered, never its judgement clauses", () => {
    expect(selectionOver(installRules(), withDocument({ "CD-14#class-syntax": "audit" }))).toEqual({
      outcome: "ok",
      value: {
        selection: {
          selected: [{ address: HONE_CLASS_SYNTAX, mechanism: "audit", exceptions: "allowed" }],
          uncovered: [HONE_ABSTRACT_SYNTAX],
          notAdopted: [],
          notRun: [],
          editions: [],
        },
        bindings: [expect.objectContaining({ mechanism: "audit" })],
        eslintConfigRoots: [],
        clauseRoots: [{ clause: HONE_CLASS_SYNTAX, ruleSetRoot: "/install" }],
        excluded: [],
        fileExceptionWhyChains: "required",
      },
    });
  });

  it("lists an unlisted mechanical clause once when two clauses of its discipline are selected", () => {
    const rules = rulesReturning({
      disciplines: [present(CD_14_WITH_THREE_MECHANICAL)],
      pieces: [present(CD_14_PIECE)],
      runner: "present",
    });
    expect(selectionOver(rules, withDocument(BOTH_CD_14_CLAUSES))).toMatchObject({
      outcome: "ok",
      value: { selection: { uncovered: [HONE_DECORATOR_SYNTAX] } },
    });
  });

  it("adopts no discipline none of whose clauses is listed", () => {
    const rules = rulesReturning({ disciplines: [present(TM_1)], pieces: [present(TM_1_PIECE)], runner: "present" });
    expect(
      selectionOver(rules, { version: 1, ruleSets: { team: "team-rules" }, clauses: { "team/TM-1#no-tmp-files": "audit" } }),
    ).toMatchObject({ outcome: "ok", value: { selection: { uncovered: [] } } });
  });
});

describe("selectionFrom reading each rule-set file", () => {
  it("reads a discipline's discipline file and piece file once each when two of its clauses are selected", () => {
    const rules = installRules();
    selectionOver(rules, withDocument(BOTH_CD_14_CLAUSES));
    expect({ disciplines: rules.discipline.mock.calls.length, pieces: rules.piece.mock.calls.length }).toEqual({
      disciplines: 1,
      pieces: 1,
    });
  });

  it("reads each mechanism's own piece when two clauses of one discipline select different mechanisms", () => {
    const rules = rulesReturning({
      disciplines: [present(CD_14_ON_TWO_MECHANISMS)],
      pieces: [present(CD_14_PIECE), present(CD_14_OXLINT_PIECE)],
      runner: "present",
    });
    expect(selectionOver(rules, withDocument({ "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "oxlint" }))).toMatchObject({
      outcome: "ok",
      value: {
        bindings: [
          { mechanism: "audit", clause: { settings: { module: "class-syntax.ts" } } },
          { mechanism: "oxlint", clause: { pieceRoot: "/install/src/infrastructure/engines/oxlint/CD-14", settings: { rule: "no-abstract" } } },
        ],
      },
    });
  });

  it("is piece-missing for the second mechanism of a discipline whose first mechanism's piece covers the clause", () => {
    const rules = rulesReturning({
      disciplines: [present(CD_14_ON_TWO_MECHANISMS)],
      pieces: [present(CD_14_PIECE), ABSENT],
      runner: "present",
    });
    expect(selectionOver(rules, withDocument({ "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "oxlint" }))).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-14#abstract-syntax", mechanism: "oxlint" },
    });
  });

  it("reads a named rule set's own discipline and piece for a discipline id the shared rule set also holds", () => {
    const rules = rulesReturning({
      disciplines: [present(CD_14), present(TEAM_CD_14)],
      pieces: [present(CD_14_PIECE), present(TEAM_CD_14_PIECE)],
      runner: "present",
    });
    expect(
      selectionOver(rules, {
        version: 1,
        ruleSets: { team: "team-rules" },
        clauses: { "CD-14#class-syntax": "audit", "team/CD-14#class-syntax": "audit" },
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        bindings: [
          {
            mechanism: "audit",
            clause: {
              address: HONE_CLASS_SYNTAX,
              anchor: { kind: "keyword", keyword: "class" },
              settings: { module: "class-syntax.ts" },
              clauseSettings: {},
              edition: "1",
            },
          },
          {
            mechanism: "audit",
            clause: {
              address: { ruleSet: { name: "team" }, discipline: "CD-14", clause: "class-syntax" },
              anchor: { kind: "keyword", keyword: "enum" },
              pieceRoot: "/repo/team-rules/mechanisms/audit/CD-14",
              settings: { module: "team-class-syntax.ts" },
              clauseSettings: {},
              edition: "1",
            },
          },
        ],
      },
    });
    expect(rules.discipline.mock.calls).toEqual([
      [{ ruleSetRoot: "/install", discipline: "CD-14" }],
      [{ ruleSetRoot: "/repo/team-rules", discipline: "CD-14" }],
    ]);
  });
});

describe("selectionFrom refusing a selection the rule sets cannot meet", () => {
  it("is unknown-rule-set for a clause naming a rule set the file does not declare", () => {
    expect(selectionOver(listingRules(ABSENT), withDocument({ "team/TM-1#no-tmp-files": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "unknown-rule-set", name: "team" },
    });
  });

  it("is unknown-discipline for a discipline the rule set does not hold", () => {
    expect(selectionOver(listingRules(ABSENT), withDocument({ "CD-99#class-syntax": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "unknown-discipline", address: "CD-99#class-syntax" },
    });
  });

  it("is unknown-clause for a clause the discipline does not declare", () => {
    expect(selectionOver(listingRules(present(CD_14)), withDocument({ "CD-14#no-such-clause": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "unknown-clause", address: "CD-14#no-such-clause" },
    });
  });

  it("is judgement-clause-selected for a judgement clause", () => {
    expect(selectionOver(listingRules(present(CD_14)), withDocument({ "CD-14#library-construction": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "judgement-clause-selected", address: "CD-14#library-construction" },
    });
  });

  it("is mechanism-not-allowed for a mechanism the clause does not list", () => {
    expect(selectionOver(listingRules(present(CD_14)), withDocument({ "CD-14#class-syntax": "oxlint" }))).toEqual({
      outcome: "failed",
      error: { kind: "mechanism-not-allowed", address: "CD-14#class-syntax", mechanism: "oxlint" },
    });
  });

  it("is runner-missing when the mechanism's runner module is absent from the install", () => {
    expect(selectionOver(listingRules(present(CD_14)), withDocument({ "CD-14#class-syntax": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "runner-missing", mechanism: "audit" },
    });
  });

  it("is piece-missing when the clause's rule set has no piece for the mechanism and discipline", () => {
    const rules = rulesReturning({ disciplines: [present(CD_14)], pieces: [ABSENT], runner: "present" });
    expect(selectionOver(rules, withDocument({ "CD-14#class-syntax": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-14#class-syntax", mechanism: "audit" },
    });
  });

  it("is piece-missing when the piece has no entry for the clause", () => {
    const rules = rulesReturning({
      disciplines: [present(CD_14)],
      pieces: [present(CD_14_WITHOUT_CLASS_SYNTAX_PIECE)],
      runner: "present",
    });
    expect(selectionOver(rules, withDocument({ "CD-14#class-syntax": "audit" }))).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "CD-14#class-syntax", mechanism: "audit" },
    });
  });

  it("carries a selected discipline file's refusal as rule-set-invalid", () => {
    const refusal = {
      kind: "rule-set-invalid",
      path: "/install/rules/CD-14/discipline.json",
      detail: "the file names discipline CD-15, not CD-14",
    } as const;
    const rules = listingRules({ outcome: "failed", error: refusal });
    expect(selectionOver(rules, withDocument({ "CD-14#class-syntax": "audit" }))).toEqual({ outcome: "failed", error: refusal });
  });
});

describe("selectionFrom with clauseSettings", () => {
  const boundWith = (clauseSettings: unknown) => ({
    outcome: "ok",
    value: {
      bindings: [
        { clause: { settings: { module: "class-syntax.ts" }, clauseSettings } },
        { clause: { settings: { module: "abstract-syntax.ts" }, clauseSettings: {} } },
      ],
    },
  });

  it("delivers the piece's declared defaults beside its untouched mechanism settings when disciplines.json sets none", () => {
    expect(selectionOver(settableRules(), withDocument(BOTH_CD_14_CLAUSES))).toMatchObject(
      boundWith({ allowedNames: [], style: "plain" }),
    );
  });

  it("replaces only the declared keys disciplines.json gives", () => {
    expect(
      selectionOver(settableRules(), {
        ...withDocument(BOTH_CD_14_CLAUSES),
        clauseSettings: { "CD-14#class-syntax": { allowedNames: ["Widget"], style: "strict" } },
      }),
    ).toMatchObject(boundWith({ allowedNames: ["Widget"], style: "strict" }));
  });

  it("matches a hone-prefixed clauseSettings key to the bare selected clause", () => {
    expect(
      selectionOver(settableRules(), {
        ...withDocument(BOTH_CD_14_CLAUSES),
        clauseSettings: { "hone/CD-14#class-syntax": { style: "strict" } },
      }),
    ).toMatchObject(boundWith({ allowedNames: [], style: "strict" }));
  });

  it("settles a team rule set's clause from its own piece's declarations", () => {
    const rules = rulesReturning({ disciplines: [present(TD_1)], pieces: [present(TD_1_PIECE)], runner: "present" });
    expect(
      selectionOver(rules, {
        version: 1,
        ruleSets: { team: "team-rules" },
        clauses: { "team/TD-1#x": "audit" },
        clauseSettings: { "team/TD-1#x": { limit: 5 } },
      }),
    ).toMatchObject({ outcome: "ok", value: { bindings: [{ clause: { settings: { module: "x.ts" }, clauseSettings: { limit: 5 } } }] } });
  });

  it.each([
    {
      name: "a key the piece does not declare",
      clauseSettings: { "CD-14#class-syntax": { module: "elsewhere.ts" } },
      detail: "clauseSettings for CD-14#class-syntax: its piece takes no module; it takes allowedNames, style",
    },
    {
      name: "a value of another JSON kind than the default",
      clauseSettings: { "CD-14#class-syntax": { allowedNames: "Widget" } },
      detail: "clauseSettings for CD-14#class-syntax: allowedNames must be an array, as its default is",
    },
    {
      name: "a value outside the declared choices",
      clauseSettings: { "CD-14#class-syntax": { style: "loose" } },
      detail: 'clauseSettings for CD-14#class-syntax: style must be one of "plain", "strict"',
    },
    {
      name: "settings for a clause whose piece declares none",
      clauseSettings: { "CD-14#abstract-syntax": { limit: 1 } },
      detail: "clauseSettings for CD-14#abstract-syntax: its piece takes no settings",
    },
  ])("is file-malformed for $name, naming the clause, the key and what is accepted", ({ clauseSettings, detail }) => {
    expect(selectionOver(settableRules(), { ...withDocument(BOTH_CD_14_CLAUSES), clauseSettings })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: SELECTION_PATH, detail },
    });
  });

  it("refuses settings for Hone's ESLint naming clause, whose piece declares no keys, as file-malformed", () => {
    const rules = rulesReturning({ disciplines: [present(CD_6)], pieces: [present(CD_6_PIECE)], runner: "present" });
    expect(
      selectionOver(rules, {
        ...withDocument({ "CD-6#naming-convention": "eslint" }),
        clauseSettings: { "CD-6#naming-convention": { convention: "snake_case" } },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: "clauseSettings for CD-6#naming-convention: its piece takes no settings",
      },
    });
  });
});

describe("selectionFrom settling each clause's edition", () => {
  const ranEditions = (request: { readonly classSyntax: string; readonly style: string }) => ({
    outcome: "ok",
    value: {
      selection: {
        editions: [{ address: HONE_CLASS_SYNTAX, mechanism: "audit", edition: request.classSyntax, latest: "2" }],
      },
      bindings: [
        { clause: { clauseSettings: { style: request.style }, edition: request.classSyntax } },
        { clause: { clauseSettings: {}, edition: "1" } },
      ],
    },
  });

  it("runs each clause's default edition and reads only clauses with more than one edition", () => {
    expect(selectionOver(editionedRules(), withDocument(BOTH_CD_14_CLAUSES))).toMatchObject(
      ranEditions({ classSyntax: "1", style: "plain" }),
    );
  });

  it("runs the latest edition of every clause when checkEditions is latest", () => {
    expect(selectionOver(editionedRules(), { ...withDocument(BOTH_CD_14_CLAUSES), checkEditions: "latest" })).toMatchObject(
      ranEditions({ classSyntax: "2", style: "plain" }),
    );
  });

  it("runs the edition a clause's settings give, keeping the piece's own settings apart", () => {
    expect(
      selectionOver(editionedRules(), {
        ...withDocument(BOTH_CD_14_CLAUSES),
        clauseSettings: { "CD-14#class-syntax": { edition: "2", style: "strict" } },
      }),
    ).toMatchObject(ranEditions({ classSyntax: "2", style: "strict" }));
  });

  it("holds a clause to the edition its settings give when checkEditions is latest", () => {
    expect(
      selectionOver(editionedRules(), {
        ...withDocument(BOTH_CD_14_CLAUSES),
        checkEditions: "latest",
        clauseSettings: { "CD-14#class-syntax": { edition: "1" } },
      }),
    ).toMatchObject(ranEditions({ classSyntax: "1", style: "plain" }));
  });

  it("accepts an edition for a clause whose piece declares no other settings", () => {
    expect(
      selectionOver(editionedRules(), {
        ...withDocument(BOTH_CD_14_CLAUSES),
        clauseSettings: { "CD-14#abstract-syntax": { edition: "1" } },
      }),
    ).toMatchObject(ranEditions({ classSyntax: "1", style: "plain" }));
  });

  it("is file-malformed for an edition the piece does not declare, naming those it does", () => {
    expect(
      selectionOver(editionedRules(), {
        ...withDocument(BOTH_CD_14_CLAUSES),
        clauseSettings: { "CD-14#class-syntax": { edition: "3" } },
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SELECTION_PATH,
        detail: 'clauseSettings for CD-14#class-syntax: edition must be one of "1", "2"',
      },
    });
  });
});

describe("selectionFrom with clauses not adopted", () => {
  it("lists a not-adopted clause apart from the selected ones and binds no mechanism for it", () => {
    expect(
      selectionOver(installRules(), withDocument({ "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "not-adopted" })),
    ).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [{ address: HONE_CLASS_SYNTAX, mechanism: "audit", exceptions: "allowed" }],
          uncovered: [],
          notAdopted: [HONE_ABSTRACT_SYNTAX],
        },
        bindings: [expect.objectContaining({ clause: expect.objectContaining({ address: HONE_CLASS_SYNTAX }) })],
      },
    });
  });

  it("reads no runner and no piece when no clause of a discipline is adopted", () => {
    const rules = listingRules(present(CD_14));
    expect(
      selectionOver(rules, withDocument({ "CD-14#class-syntax": "not-adopted", "CD-14#abstract-syntax": "not-adopted" })),
    ).toEqual({
      outcome: "ok",
      value: {
        selection: { selected: [], uncovered: [], notAdopted: [HONE_CLASS_SYNTAX, HONE_ABSTRACT_SYNTAX], notRun: [], editions: [] },
        bindings: [],
        eslintConfigRoots: [],
        clauseRoots: [],
        excluded: [],
        fileExceptionWhyChains: "required",
      },
    });
    expect({ pieces: rules.piece.mock.calls.length, runners: rules.runner.mock.calls.length }).toEqual({ pieces: 0, runners: 0 });
  });

  it("still lists a clause missing from the selection as uncovered beside a not-adopted one", () => {
    expect(
      selectionOver(listingRules(present(CD_14_WITH_THREE_MECHANICAL)), withDocument({ "CD-14#class-syntax": "not-adopted" })),
    ).toMatchObject({
      outcome: "ok",
      value: { selection: { uncovered: [HONE_ABSTRACT_SYNTAX, HONE_DECORATOR_SYNTAX], notAdopted: [HONE_CLASS_SYNTAX] } },
    });
  });

  it("reads a team rule set's not-adopted clause from its own discipline, reading no piece", () => {
    const rules = listingRules(present(TM_1));
    expect(
      selectionOver(rules, { version: 1, ruleSets: { team: "team-rules" }, clauses: { "team/TM-1#no-tmp-files": "not-adopted" } }),
    ).toMatchObject({ outcome: "ok", value: { selection: { notAdopted: [TEAM_NO_TMP_FILES] }, bindings: [] } });
    expect(rules.piece).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "a clause its discipline does not declare",
      clause: "CD-14#no-such-clause",
      read: present(CD_14),
      error: { kind: "unknown-clause", address: "CD-14#no-such-clause" },
    },
    {
      name: "a discipline the rule set does not hold",
      clause: "CD-99#class-syntax",
      read: ABSENT,
      error: { kind: "unknown-discipline", address: "CD-99#class-syntax" },
    },
    {
      name: "a judgement clause",
      clause: "CD-14#library-construction",
      read: present(CD_14),
      error: { kind: "judgement-clause-listed", address: "CD-14#library-construction" },
    },
    {
      name: "a rule set the file does not declare",
      clause: "team/TM-1#no-tmp-files",
      read: present(CD_14),
      error: { kind: "unknown-rule-set", name: "team" },
    },
  ])("refuses not adopting $name", ({ clause, read, error }) => {
    expect(selectionOver(listingRules(read), withDocument({ [clause]: "not-adopted" }))).toEqual({ outcome: "failed", error });
  });
});

describe("selectionFrom with clauses adopted but not run", () => {
  it("lists a not-run clause apart from the selected and not-adopted ones and binds no mechanism for it", () => {
    expect(
      selectionOver(installRules(), withDocument({ "CD-14#class-syntax": "audit", "CD-14#abstract-syntax": "not-run" })),
    ).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [{ address: HONE_CLASS_SYNTAX, mechanism: "audit", exceptions: "allowed" }],
          uncovered: [],
          notAdopted: [],
          notRun: [HONE_ABSTRACT_SYNTAX],
          editions: [],
        },
        bindings: [expect.objectContaining({ clause: expect.objectContaining({ address: HONE_CLASS_SYNTAX }) })],
      },
    });
  });

  it("reads no runner and no piece when no clause of a discipline runs", () => {
    const rules = listingRules(present(CD_14));
    expect(
      selectionOver(rules, withDocument({ "CD-14#class-syntax": "not-run", "CD-14#abstract-syntax": "not-adopted" })),
    ).toEqual({
      outcome: "ok",
      value: {
        selection: { selected: [], uncovered: [], notAdopted: [HONE_ABSTRACT_SYNTAX], notRun: [HONE_CLASS_SYNTAX], editions: [] },
        bindings: [],
        eslintConfigRoots: [],
        clauseRoots: [],
        excluded: [],
        fileExceptionWhyChains: "required",
      },
    });
    expect({ pieces: rules.piece.mock.calls.length, runners: rules.runner.mock.calls.length }).toEqual({ pieces: 0, runners: 0 });
  });

  it("still lists a clause missing from the selection as uncovered beside a not-run one", () => {
    expect(
      selectionOver(listingRules(present(CD_14_WITH_THREE_MECHANICAL)), withDocument({ "CD-14#class-syntax": "not-run" })),
    ).toMatchObject({
      outcome: "ok",
      value: {
        selection: { uncovered: [HONE_ABSTRACT_SYNTAX, HONE_DECORATOR_SYNTAX], notRun: [HONE_CLASS_SYNTAX], editions: [] },
      },
    });
  });

  it.each([
    {
      name: "a clause its discipline does not declare",
      clause: "CD-14#no-such-clause",
      error: { kind: "unknown-clause", address: "CD-14#no-such-clause" },
    },
    {
      name: "a judgement clause",
      clause: "CD-14#library-construction",
      error: { kind: "judgement-clause-listed", address: "CD-14#library-construction" },
    },
    {
      name: "a rule set the file does not declare",
      clause: "team/TM-1#no-tmp-files",
      error: { kind: "unknown-rule-set", name: "team" },
    },
  ])("refuses not running $name", ({ clause, error }) => {
    expect(selectionOver(listingRules(present(CD_14)), withDocument({ [clause]: "not-run" }))).toEqual({
      outcome: "failed",
      error,
    });
  });
});

const TEAM_RULE_SETS: Readonly<Record<string, RuleSetLocation>> = {
  team: { location: "folder", path: repoPathSchema.parse("rules/team") },
};

const UNRESOLVABLE_PATH: PathPort = {
  ...POSIX_PATH,
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({
    outcome: "failed",
    error: { kind: "working-directory-unusable", path: "/repo/rules/team" },
  }),
};

describe("ruleSetRootOf", () => {
  it("roots the hone rule set at the install root", () => {
    expect(
      ruleSetRootOf({ ruleSet: "hone", ruleSets: TEAM_RULE_SETS, repoRoot: REPO_ROOT, installRoot: INSTALL_ROOT, path: POSIX_PATH }),
    ).toEqual({ outcome: "ok", value: "/install" });
  });

  it("roots a named rule set at the resolved join of the repo root and its declared directory", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: ruleSetNameSchema.parse("team") },
        ruleSets: TEAM_RULE_SETS,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: POSIX_PATH,
      }),
    ).toEqual({ outcome: "ok", value: "/repo/rules/team" });
  });

  it("is unknown-rule-set for a named rule set the consumer file does not declare", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: ruleSetNameSchema.parse("ghost") },
        ruleSets: TEAM_RULE_SETS,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: POSIX_PATH,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "unknown-rule-set", name: "ghost" } });
  });

  it("is rule-set-invalid at the joined directory when a named rule set's directory resolves to no absolute path", () => {
    expect(
      ruleSetRootOf({
        ruleSet: { name: ruleSetNameSchema.parse("team") },
        ruleSets: TEAM_RULE_SETS,
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        path: UNRESOLVABLE_PATH,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-set-invalid",
        path: "/repo/rules/team",
        detail: "the directory of rule set team resolves to no absolute path",
      },
    });
  });
});

const FIXTURES = `${import.meta.dirname}/../content-files/rule-sets/team-rule-set`;

const DISK_PATH = createDefaultPathPort({});

const fixtureRoot = (name: string) => {
  const resolved = DISK_PATH.resolve({ path: `${FIXTURES}/${name}` });
  assert(resolved.outcome === "ok", `${name} resolves to an absolute path`);
  return resolved.value;
};

const diskOptions = (repo: string) => ({
  repoRoot: fixtureRoot(repo),
  installRoot: fixtureRoot("install"),
  moduleExtension: ".js" as const,
  fileText: createDefaultFileTextPort({}),
  path: DISK_PATH,
});

describe("reading the selection from disk", () => {
  it("reads the disciplines.json, the discipline and the piece of a named rule set, and the install's runner", () => {
    expect(createSelectionRepository(diskOptions("repo")).read({})).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [{ address: TEAM_NO_TMP_FILES, mechanism: "audit", exceptions: "allowed" }],
          uncovered: [],
          notAdopted: [],
          notRun: [],
          editions: [],
        },
        bindings: [{ mechanism: "audit", clause: { address: TEAM_NO_TMP_FILES, settings: { module: "no-tmp-files.ts" }, edition: "1" } }],
        excluded: ["vendor"],
        fileExceptionWhyChains: "required",
      },
    });
  });

  it("preserves the canonical selection read failure at the captured repository root", () => {
    expect(createSelectionRepository(diskOptions("install")).read({})).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable" },
    });
  });

  it("is file-unreadable when disciplines.json cannot be read, so no default output is guessed", () => {
    expect(readRunSettings({ fileText: createDefaultFileTextPort({}), path: DISK_PATH, repoRoot: fixtureRoot("install") })).toMatchObject({
      outcome: "failed",
      error: { kind: "file-unreadable" },
    });
  });

  it("reads the run settings of a disciplines.json on disk without resolving its clauses", () => {
    expect(readRunSettings({ fileText: createDefaultFileTextPort({}), path: DISK_PATH, repoRoot: fixtureRoot("repo") })).toEqual({
      outcome: "ok",
      value: { reportOutput: "full", assessment: { forfeiture: "this-run" } },
    });
  });
});
