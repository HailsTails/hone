import { describe, expect, it, vi } from "vitest";

import type {
  Check,
  Engine,
  Principle,
  RecordKind,
  Symptom,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../../domain/language-layer/symptom-catalogue.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import { editionOf } from "../../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../../domain/rule-set/rule-set-name-of.ts";
import { DEFAULT_CONVENTIONS } from "../../../domain/settings/conventions.ts";
import type { ListedAddress } from "../../../domain/settings/listed-address.ts";
import type { SettingsFile, SettingsFileFault } from "../../../domain/settings/settings-file.ts";
import type {
  CheckPieceSource,
  PieceClause,
  SettingsSources,
} from "../../ports/settings-sources.ts";
import type { SettingsFileFormat } from "../../ports/settings/settings-file-format.ts";
import { type NamedSettingsReading, readNamedSettings } from "./read-settings.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const SETTINGS_PATH = "/repo/hone.config.json";

const AUDIT = "walker" as const;

const NO_HIDDEN_EFFECTS: Principle = { name: "no-hidden-effects", title: "No hidden effects" };

const DEBT: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const AUTHORISED_LOCATION: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const LOOP_KEYWORD: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "loop-keyword",
  title: "Loop keyword",
  seen: "`for` or `while`.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const REBINDING: Symptom = { ...LOOP_KEYWORD, name: "rebinding", title: "Rebinding" };

const LOOPS_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-15"),
  clause: clauseIdOf("loops"),
};

const TEST_BODY_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-27"),
  clause: clauseIdOf("test-body-logic"),
};

const LAYERING_CLAUSE: ClauseAddress = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-13"),
  clause: clauseIdOf("layering"),
};

const LOOP_KEYWORD_LOOPS: Check = {
  name: "loops",
  symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
  page: "loop-keyword/loops.md",
  clause: LOOPS_CLAUSE,
  engines: [WALKER, ESLINT_ENGINE],
  forms: [],
  findingSpecifics: [],
};

const LOOP_KEYWORD_TEST_BODY: Check = {
  name: "test-body",
  symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
  page: "loop-keyword/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-for-loop"],
  findingSpecifics: [],
};

const REBINDING_TEST_BODY: Check = {
  name: "test-body",
  symptom: { ruleSet: TOOL_RULE_SET, name: "rebinding" },
  page: "rebinding/test-body.md",
  clause: TEST_BODY_CLAUSE,
  engines: [WALKER],
  forms: ["a-let"],
  findingSpecifics: [],
};

const SETTINGS_CATALOGUE: SymptomCatalogue = {
  principles: [NO_HIDDEN_EFFECTS],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [AUTHORISED_LOCATION, DEBT],
  engines: [WALKER, ESLINT_ENGINE],
  symptoms: [LOOP_KEYWORD, REBINDING],
  clauses: [
    {
      clause: LOOPS_CLAUSE,
      sight: { kind: "one-symptom", symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" } },
    },
    {
      clause: TEST_BODY_CLAUSE,
      sight: {
        kind: "symptom-by-form",
        forms: [
          { form: "a-for-loop", symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" } },
          { form: "a-let", symptom: { ruleSet: TOOL_RULE_SET, name: "rebinding" } },
        ],
      },
    },
    {
      clause: LAYERING_CLAUSE,
      sight: { kind: "one-symptom", symptom: { ruleSet: TOOL_RULE_SET, name: "rebinding" } },
    },
  ],
  checks: [LOOP_KEYWORD_LOOPS, LOOP_KEYWORD_TEST_BODY, REBINDING_TEST_BODY],
  namedBans: [],
};

const FIRST = editionOf("1");

const SECOND = editionOf("2");

const LOOPS_PIECE: PieceClause = {
  exceptions: "allowed",
  anchor: { kind: "file" },
  pieceRoot: "/install/mechanisms/audit/CD-15",
  settings: { keywords: ["for", "while"] },
  declarations: {},
  editions: { declared: [FIRST, SECOND], default: FIRST, latest: SECOND },
};

const DOCUMENT = { version: 2 };

const LOOPS_ADDRESS: ListedAddress = { ruleSet: TOOL_RULE_SET, check: "loop-keyword#loops" };

const SETTINGS_FILE: SettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [
    { address: LOOPS_ADDRESS, state: { state: "run", engine: "walker" } },
    {
      address: { ruleSet: TOOL_RULE_SET, check: "loop-keyword#test-body" },
      state: { state: "not-adopted" },
    },
    {
      address: { ruleSet: TOOL_RULE_SET, check: "rebinding#test-body" },
      state: { state: "not-adopted" },
    },
  ],
  checkSettings: [{ address: LOOPS_ADDRESS, values: { edition: "2" } }],
  forfeiture: "elsewhere",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  eslintProjectionKind: "ts",
  conventions: { conventions: DEFAULT_CONVENTIONS, declared: [] },
};

const formatGiving = (
  file: Result<SettingsFile, SettingsFileFault>,
): Pick<SettingsFileFormat, "fileOf"> => ({
  fileOf: vi.fn<SettingsFileFormat["fileOf"]>().mockReturnValue(file),
});

const SETTINGS_FORMAT = formatGiving({ outcome: "ok", value: SETTINGS_FILE });

const sourcesHolding = (request: { readonly document: unknown }): SettingsSources => ({
  settingsFile: vi
    .fn<SettingsSources["settingsFile"]>()
    .mockReturnValue({ outcome: "ok", value: { path: SETTINGS_PATH, document: request.document } }),
  ruleSetRoot: vi
    .fn<SettingsSources["ruleSetRoot"]>()
    .mockReturnValue({ outcome: "ok", value: INSTALL_ROOT }),
  catalogue: vi.fn<SettingsSources["catalogue"]>().mockReturnValue({
    outcome: "ok",
    value: { held: "catalogue", catalogue: SETTINGS_CATALOGUE },
  }),
});

describe("readNamedSettings and the settings document", () => {
  it("gives the check choices, binding, edition, reporting settings and ESLint projection kind from the document", () => {
    expect(
      readNamedSettings({
        settingsFormat: SETTINGS_FORMAT,
        sources: sourcesHolding({
          document: DOCUMENT,
        }),
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toEqual<{ readonly outcome: "ok"; readonly value: NamedSettingsReading }>({
      outcome: "ok",
      value: {
        available: [],
        selection: {
          selected: [
            {
              address: LOOPS_ADDRESS,
              check: LOOP_KEYWORD_LOOPS,
              exceptions: "allowed",
              editions: { declared: [FIRST, SECOND], default: FIRST, latest: SECOND },
              binding: {
                address: "loop-keyword#loops",
                ruleSet: TOOL_RULE_SET,
                engine: "walker",
                anchor: { kind: "file" },
                pieceRoot: "/install/mechanisms/audit/CD-15",
                settings: { keywords: ["for", "while"] },
                forms: {},
                checkSettings: {},
                edition: SECOND,
              },
            },
          ],
          notAdopted: [
            {
              address: { ruleSet: TOOL_RULE_SET, check: "loop-keyword#test-body" },
              check: LOOP_KEYWORD_TEST_BODY,
              choice: { state: "not-adopted" },
            },
            {
              address: { ruleSet: TOOL_RULE_SET, check: "rebinding#test-body" },
              check: REBINDING_TEST_BODY,
              choice: { state: "not-adopted" },
            },
          ],
          notRun: [],
          excluded: [],
          eslintConfigRoots: [],
        },
        runSettings: { reportOutput: "full", assessment: { forfeiture: "elsewhere" } },
        eslintConfigLookup: { lookup: "detected" },
        eslintProjectionKind: "ts",
        conventions: DEFAULT_CONVENTIONS,
        notes: [],
      },
    });
  });

  it("reads the settings file's document through the settings format", () => {
    const settingsFormat = formatGiving({ outcome: "ok", value: SETTINGS_FILE });
    readNamedSettings({
      settingsFormat,
      sources: sourcesHolding({ document: DOCUMENT }),
      readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
        outcome: "ok",
        value: { ...LOOPS_PIECE, forms: {} },
      }),
    });
    expect(vi.mocked(settingsFormat.fileOf).mock.calls).toEqual([[{ document: DOCUMENT }]]);
  });

  it("asks for each selected named piece at its rule-set root", () => {
    const sources = sourcesHolding({
      document: DOCUMENT,
    });
    const readPiece = vi.fn<CheckPieceSource>().mockReturnValue({
      outcome: "ok",
      value: { ...LOOPS_PIECE, forms: {} },
    });
    readNamedSettings({ settingsFormat: SETTINGS_FORMAT, sources, readPiece });
    expect(readPiece).toHaveBeenCalledExactlyOnceWith({
      ruleSetRoot: INSTALL_ROOT,
      names: { symptom: "loop-keyword", check: "loops" },
      mechanism: "walker",
    });
  });

  it("notes each declared convention no check reads yet, and not the test files the walker reads", () => {
    expect(
      readNamedSettings({
        settingsFormat: formatGiving({
          outcome: "ok",
          value: {
            ...SETTINGS_FILE,
            conventions: {
              conventions: {
                generated: [{ files: ["src/generated/**"], outsideParty: "@graphql-codegen/cli" }],
                layers: [{ layer: "domain", folders: [repoPathOf("src/domain")] }],
                testFiles: { suffixes: ["spec"], folders: ["__tests__"] },
              },
              declared: ["generated", "layers", "testFiles"],
            },
          },
        }),
        sources: sourcesHolding({
          document: DOCUMENT,
        }),
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        conventions: { testFiles: { suffixes: ["spec"], folders: ["__tests__"] } },
        notes: [
          { kind: "declared-not-read", key: "generated" },
          { kind: "declared-not-read", key: "layers" },
        ],
      },
    });
  });

  it("refuses a file its wire refuses, naming the file", () => {
    expect(
      readNamedSettings({
        settingsFormat: formatGiving({
          outcome: "failed",
          error: {
            kind: "malformed",
            detail:
              '✖ removed: "fileExceptionWhyChains"; every record shows its why-chain in version 2\n  → at fileExceptionWhyChains',
          },
        }),
        sources: sourcesHolding({
          document: DOCUMENT,
        }),
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SETTINGS_PATH,
        detail:
          '✖ removed: "fileExceptionWhyChains"; every record shows its why-chain in version 2\n  → at fileExceptionWhyChains',
      },
    });
  });

  it("refuses a check the catalogue does not hold, in the new words", () => {
    expect(
      readNamedSettings({
        settingsFormat: formatGiving({
          outcome: "ok",
          value: {
            ...SETTINGS_FILE,
            checks: [
              {
                address: { ruleSet: TOOL_RULE_SET, check: "loop-keyword#nowhere" },
                state: { state: "run", engine: "walker" },
              },
            ],
            checkSettings: [],
          },
        }),
        sources: sourcesHolding({
          document: DOCUMENT,
        }),
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-check", address: "loop-keyword#nowhere" },
    });
  });

  it("refuses an edition the piece does not declare, naming the check it was given on", () => {
    expect(
      readNamedSettings({
        settingsFormat: formatGiving({
          outcome: "ok",
          value: {
            ...SETTINGS_FILE,
            checkSettings: [{ address: LOOPS_ADDRESS, values: { edition: "3" } }],
          },
        }),
        sources: sourcesHolding({
          document: DOCUMENT,
        }),
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: SETTINGS_PATH,
        detail: 'checkSettings for loop-keyword#loops: edition must be one of "1", "2"',
      },
    });
  });

  it("passes on the failure of a piece it cannot read", () => {
    expect(
      readNamedSettings({
        settingsFormat: SETTINGS_FORMAT,
        sources: sourcesHolding({
          document: DOCUMENT,
        }),
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "failed",
          error: { kind: "piece-missing", address: "loop-keyword#loops", mechanism: "walker" },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "piece-missing", address: "loop-keyword#loops", mechanism: "walker" },
    });
  });
});

describe("readNamedSettings", () => {
  it("asks for each catalogue with the rule set it is read for", () => {
    const sources = sourcesHolding({
      document: DOCUMENT,
    });
    readNamedSettings({
      settingsFormat: SETTINGS_FORMAT,
      sources,
      readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
        outcome: "ok",
        value: { ...LOOPS_PIECE, forms: {} },
      }),
    });
    expect(sources.catalogue).toHaveBeenCalledExactlyOnceWith({
      ruleSetRoot: INSTALL_ROOT,
      ruleSet: TOOL_RULE_SET,
    });
  });

  it("binds a team's selected check to the team's rule set", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamLoop: Symptom = { ...LOOP_KEYWORD, ruleSet: acme, name: "team-loop" };
    const address: ListedAddress = { ruleSet: acme, check: "team-loop#loops" };
    const sources = {
      ...sourcesHolding({ document: DOCUMENT }),
      catalogue: vi.fn<SettingsSources["catalogue"]>().mockReturnValue({
        outcome: "ok",
        value: {
          held: "catalogue",
          catalogue: {
            ...SETTINGS_CATALOGUE,
            symptoms: [teamLoop],
            clauses: [],
            checks: [
              {
                name: "loops",
                symptom: { ruleSet: acme, name: "team-loop" },
                page: "team-loop/loops.md",
                engines: [WALKER],
                forms: [],
                findingSpecifics: [],
              },
            ],
          },
        },
      }),
    };
    const settingsFormat = formatGiving({
      outcome: "ok",
      value: {
        ...SETTINGS_FILE,
        ruleSets: [{ name: acme.name, location: { location: "repo-root" } }],
        checks: [{ address, state: { state: "run", engine: "walker" } }],
        checkSettings: [],
      },
    });
    expect(
      readNamedSettings({
        sources,
        settingsFormat,
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [{ address, binding: { address: "team-loop#loops", ruleSet: acme } }],
        },
      },
    });
  });

  it("places a folder team's symptom, recipe and check files under the team's folder", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamLoop: Symptom = {
      ...LOOP_KEYWORD,
      ruleSet: acme,
      name: "team-loop",
      sourceFile: "rules/typescript/symptoms/team-loop.md",
    };
    const sources = {
      ...sourcesHolding({ document: DOCUMENT }),
      catalogue: vi.fn<SettingsSources["catalogue"]>().mockReturnValue({
        outcome: "ok",
        value: {
          held: "catalogue",
          catalogue: {
            ...SETTINGS_CATALOGUE,
            symptoms: [teamLoop],
            recipes: [
              {
                ruleSet: acme,
                name: "team-iteration",
                sourceFile: "rules/typescript/recipes/team-iteration.md",
                title: "Team iteration",
                standing: "accepted",
                reason: { text: "It reads flat.", standing: "accepted" },
              },
            ],
            clauses: [],
            checks: [
              {
                name: "loops",
                symptom: { ruleSet: acme, name: "team-loop" },
                page: "rules/typescript/symptoms/team-loop/loops.md",
                engines: [WALKER],
                forms: [],
                findingSpecifics: [],
              },
            ],
          },
        },
      }),
    };
    const settingsFormat = formatGiving({
      outcome: "ok",
      value: {
        ...SETTINGS_FILE,
        ruleSets: [
          { name: acme.name, location: { location: "folder", path: repoPathOf("team-rules") } },
        ],
        checks: [
          {
            address: { ruleSet: acme, check: "team-loop#loops" },
            state: { state: "run", engine: "walker" },
          },
        ],
        checkSettings: [],
      },
    });
    const readPiece = vi.fn<CheckPieceSource>().mockReturnValue({
      outcome: "ok",
      value: { ...LOOPS_PIECE, forms: {} },
    });

    const read = readNamedSettings({ sources, settingsFormat, readPiece });

    expect(read).toMatchObject({
      outcome: "ok",
      value: {
        externalCatalogues: [
          {
            ruleSet: acme,
            catalogue: {
              recipes: [{ sourceFile: "team-rules/rules/typescript/recipes/team-iteration.md" }],
              symptoms: [{ sourceFile: "team-rules/rules/typescript/symptoms/team-loop.md" }],
              checks: [
                {
                  symptom: { ruleSet: acme, name: "team-loop" },
                  page: "team-rules/rules/typescript/symptoms/team-loop/loops.md",
                },
              ],
            },
          },
        ],
      },
    });
  });

  it("binds a team's check under a symptom that shares its name with one of Hone's, beside Hone's own", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamLoopKeyword: Symptom = { ...LOOP_KEYWORD, ruleSet: acme };
    const teamAddress: ListedAddress = { ruleSet: acme, check: "loop-keyword#team-loops" };
    const sources = {
      ...sourcesHolding({ document: DOCUMENT }),
      catalogue: vi
        .fn<SettingsSources["catalogue"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: { held: "catalogue", catalogue: SETTINGS_CATALOGUE },
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: {
            held: "catalogue",
            catalogue: {
              ...SETTINGS_CATALOGUE,
              symptoms: [teamLoopKeyword],
              clauses: [],
              checks: [
                {
                  name: "team-loops",
                  symptom: { ruleSet: acme, name: "loop-keyword" },
                  page: "loop-keyword/team-loops.md",
                  engines: [WALKER],
                  forms: [],
                  findingSpecifics: [],
                },
              ],
            },
          },
        }),
    };
    const settingsFormat = formatGiving({
      outcome: "ok",
      value: {
        ...SETTINGS_FILE,
        ruleSets: [{ name: acme.name, location: { location: "repo-root" } }],
        checks: [
          { address: LOOPS_ADDRESS, state: { state: "run", engine: "walker" } },
          { address: teamAddress, state: { state: "run", engine: "walker" } },
        ],
        checkSettings: [],
      },
    });
    expect(
      readNamedSettings({
        sources,
        settingsFormat,
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            { address: LOOPS_ADDRESS, binding: { address: "loop-keyword#loops", ruleSet: "hone" } },
            {
              address: teamAddress,
              binding: { address: "loop-keyword#team-loops", ruleSet: acme },
            },
          ],
        },
      },
    });
  });

  it("refuses a team check whose address is also one of Hone's checks, naming both rule sets", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const teamLoopKeyword: Symptom = { ...LOOP_KEYWORD, ruleSet: acme };
    const sources = {
      ...sourcesHolding({ document: DOCUMENT }),
      catalogue: vi
        .fn<SettingsSources["catalogue"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: { held: "catalogue", catalogue: SETTINGS_CATALOGUE },
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value: {
            held: "catalogue",
            catalogue: {
              ...SETTINGS_CATALOGUE,
              symptoms: [teamLoopKeyword],
              clauses: [],
              checks: [
                {
                  name: "loops",
                  symptom: { ruleSet: acme, name: "loop-keyword" },
                  page: "loop-keyword/loops.md",
                  engines: [WALKER],
                  forms: [],
                  findingSpecifics: [],
                },
              ],
            },
          },
        }),
    };
    const settingsFormat = formatGiving({
      outcome: "ok",
      value: {
        ...SETTINGS_FILE,
        ruleSets: [{ name: acme.name, location: { location: "repo-root" } }],
        checks: [
          { address: LOOPS_ADDRESS, state: { state: "run", engine: "walker" } },
          {
            address: { ruleSet: acme, check: "loop-keyword#loops" },
            state: { state: "run", engine: "walker" },
          },
        ],
        checkSettings: [],
      },
    });
    expect(
      readNamedSettings({
        sources,
        settingsFormat,
        readPiece: vi.fn<CheckPieceSource>().mockReturnValue({
          outcome: "ok",
          value: { ...LOOPS_PIECE, forms: {} },
        }),
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "rule-sets-share-a-check",
        check: "loop-keyword#loops",
        ruleSets: ["hone", "acme"],
      },
    });
  });

  it("resolves an opt-in check which has no version one clause", () => {
    const address: ListedAddress = { ruleSet: TOOL_RULE_SET, check: "loop-keyword#new-loop-check" };
    const catalogue: SymptomCatalogue = {
      ...SETTINGS_CATALOGUE,
      checks: [
        {
          name: "new-loop-check",
          symptom: { ruleSet: TOOL_RULE_SET, name: "loop-keyword" },
          page: "loop-keyword/new-loop-check.md",
          engines: [{ name: "walker" }],
          forms: [],
          findingSpecifics: [],
        },
      ],
    };
    const sources = {
      ...sourcesHolding({ document: DOCUMENT }),
      catalogue: vi
        .fn<SettingsSources["catalogue"]>()
        .mockReturnValue({ outcome: "ok", value: { held: "catalogue", catalogue } }),
    };
    const readPiece = vi
      .fn<CheckPieceSource>()
      .mockReturnValue({ outcome: "ok", value: { ...LOOPS_PIECE, forms: {} } });
    const settingsFormat = formatGiving({
      outcome: "ok",
      value: {
        ...SETTINGS_FILE,
        checks: [{ address, state: { state: "run", engine: "walker" } }],
        checkSettings: [],
      },
    });
    expect(readNamedSettings({ sources, readPiece, settingsFormat })).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            {
              address,
              binding: { address: "loop-keyword#new-loop-check", engine: "walker", edition: FIRST },
            },
          ],
        },
      },
    });
    expect(readPiece).toHaveBeenCalledExactlyOnceWith({
      names: { symptom: "loop-keyword", check: "new-loop-check" },
      ruleSetRoot: INSTALL_ROOT,
      mechanism: "walker",
    });
  });

  it("loads the selected check's piece and keeps a sibling off even when both share a legacy clause", () => {
    const source = sourcesHolding({
      document: DOCUMENT,
    });
    const readPiece = vi.fn<CheckPieceSource>().mockReturnValue({
      outcome: "ok",
      value: {
        ...LOOPS_PIECE,
        pieceRoot: "/install/pieces/test-body",
        forms: { "a-let": "rebinding#test-body" },
      },
    });
    const rebinding: ListedAddress = { ruleSet: TOOL_RULE_SET, check: "rebinding#test-body" };
    const loop: ListedAddress = { ruleSet: TOOL_RULE_SET, check: "loop-keyword#test-body" };
    const settingsFormat = formatGiving({
      outcome: "ok",
      value: {
        ...SETTINGS_FILE,
        checks: [
          { address: rebinding, state: { state: "run", engine: "walker" } },
          { address: loop, state: { state: "not-run" } },
        ],
        checkSettings: [{ address: rebinding, values: { edition: "2" } }],
      },
    });

    const reading = readNamedSettings({ sources: source, readPiece, settingsFormat });

    expect(reading).toMatchObject({
      outcome: "ok",
      value: {
        selection: {
          selected: [
            {
              address: rebinding,
              binding: {
                address: "rebinding#test-body",
                forms: { "a-let": "rebinding#test-body" },
                edition: SECOND,
              },
            },
          ],
          notRun: [{ address: loop }],
          notAdopted: [],
        },
      },
    });
    expect(readPiece).toHaveBeenCalledExactlyOnceWith({
      names: { symptom: "rebinding", check: "test-body" },
      ruleSetRoot: INSTALL_ROOT,
      mechanism: "walker",
    });
  });
});
