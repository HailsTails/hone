import { describe, expect, it } from "vitest";
import type { ConsumerSelectionFile } from "../../../infrastructure/disciplines-file/selection-file.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import type { SettingsFile } from "../../../infrastructure/hone-config-file/settings-file.ts";
import type { Check, Engine, Principle, RecordKind, Symptom, SymptomCatalogue } from "../../../domain/language-layer/symptom-catalogue.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema, ruleSetNameSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { mappedSettings, type SettingsMappingRequest } from "./settings-mapping.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const LAYERING_CLAUSE = clauseAddressSchema.parse("CD-13#layering");

const LOOPS_CHECK = { ruleSet: "hone", check: "loop-count#loops" } as const;

const SHARED_SYMPTOM_LOOPS_CHECK = { ruleSet: "hone", check: "loop-keyword#loops" } as const;

const LOOP_KEYWORD_TEST_BODY = { ruleSet: "hone", check: "loop-keyword#test-body" } as const;

const REBINDING_TEST_BODY = { ruleSet: "hone", check: "rebinding#test-body" } as const;

const BASE_SELECTION: ConsumerSelectionFile = {
  version: 1,
  ruleSets: [],
  clauses: [],
  exclude: [],
  eslintConfigRoots: [],
  fileExceptionWhyChains: "required",
  reportOutput: "full",
  assessment: { forfeiture: "this-run" },
  clauseSettings: [],
  checkEditions: "pinned",
};

const BASE_SETTINGS: SettingsFile = {
  exclude: [],
  ruleSets: [],
  checks: [],
  checkSettings: [],
  forfeiture: "this-run",
  reportOutput: "full",
  checkEditions: "pinned",
  eslintConfigLookup: { lookup: "detected" },
  eslintConfigRoots: [],
  conventions: { conventions: { generated: [], layers: [] }, declared: [] },
};

const ESLINT = mechanismIdSchema.parse("eslint");

const LOOPS_CLAUSE = clauseAddressSchema.parse("CD-15#loops");

const TEST_BODY_CLAUSE = clauseAddressSchema.parse("CD-27#test-body-logic");

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

const LOOP_KEYWORD_LOOPS: Check = { name: "loops", symptom: LOOP_KEYWORD, clause: LOOPS_CLAUSE, engines: [WALKER, ESLINT_ENGINE], forms: [] };

const TEST_BODY_LOOP_KEYWORD_CHECK: Check = { name: "test-body", symptom: LOOP_KEYWORD, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-for-loop"] };

const TEST_BODY_REBINDING_CHECK: Check = { name: "test-body", symptom: REBINDING, clause: TEST_BODY_CLAUSE, engines: [WALKER], forms: ["a-let"] };

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
  checks: [LOOP_KEYWORD_LOOPS, TEST_BODY_LOOP_KEYWORD_CHECK, TEST_BODY_REBINDING_CHECK],
  namedBans: [],
};

const CROSS_DISCIPLINE_CATALOGUES: readonly RuleSetCatalogue[] = [{ ruleSet: "hone", catalogue: SETTINGS_CATALOGUE }];

const OWN_SYMPTOM_LOOPS_CHECK: Check = {
  ...LOOP_KEYWORD_LOOPS,
  symptom: { ...LOOP_KEYWORD_LOOPS.symptom, name: "loop-count" },
};

const BASE_REQUEST: SettingsMappingRequest = {
  selection: BASE_SELECTION,
  catalogues: [
    {
      ruleSet: "hone",
      catalogue: { ...SETTINGS_CATALOGUE, checks: [OWN_SYMPTOM_LOOPS_CHECK, TEST_BODY_LOOP_KEYWORD_CHECK, TEST_BODY_REBINDING_CHECK] },
    },
  ],
};

const OTHER_WALKER: Engine = { name: "second-walker", mechanism: AUDIT };

const TWO_ENGINE_CHECK: Check = { ...SETTINGS_CATALOGUE.checks[0], engines: [WALKER, OTHER_WALKER] };

const TWO_ENGINE_CATALOGUES: readonly RuleSetCatalogue[] = [
  { ruleSet: "hone", catalogue: { ...SETTINGS_CATALOGUE, checks: [TWO_ENGINE_CHECK] } },
];

const okWith = (request: { readonly settings: Partial<SettingsFile> }) => ({
  outcome: "ok",
  value: { settings: { ...BASE_SETTINGS, ...request.settings }, drops: [], markedNotAdopted: [] },
});

describe("mappedSettings carrying the settings that keep their name", () => {
  it("keeps a declared rule set and its location", () => {
    const team = ruleSetNameSchema.parse("team");
    const location = { location: "folder", path: repoPathSchema.parse("team-rules") } as const;
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, ruleSets: [[team, location]] } })).toEqual(
      okWith({ settings: { ruleSets: [{ name: team, location }] } }),
    );
  });

  it("keeps the excluded paths", () => {
    const vendor = repoPathSchema.parse("vendor");
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, exclude: [vendor] } })).toEqual(
      okWith({ settings: { exclude: [vendor] } }),
    );
  });

  it("keeps a declared ESLint config lookup", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, eslintConfigLookup: "repository-root" } })).toEqual(
      okWith({ settings: { eslintConfigLookup: { lookup: "declared", value: "repository-root" } } }),
    );
  });

  it("detects the ESLint config when version 1 declared no lookup", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: { eslintConfigLookup: { lookup: "detected" } } }));
  });

  it("keeps the report output", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, reportOutput: "counts" } })).toEqual(
      okWith({ settings: { reportOutput: "counts" } }),
    );
  });

  it("writes version 1's failures-only report output as actionable", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, reportOutput: "failures-only" } })).toEqual(
      okWith({ settings: { reportOutput: "actionable" } }),
    );
  });

  it("moves the assessment's forfeiture to the top level, the adopter's own value", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, assessment: { forfeiture: "elsewhere" } } })).toEqual(
      okWith({ settings: { forfeiture: "elsewhere" } }),
    );
  });

  it("keeps the check editions rule", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, checkEditions: "latest" } })).toEqual(
      okWith({ settings: { checkEditions: "latest" } }),
    );
  });

  it("writes no ESLint projection setting, since version 1 has none", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: {} }));
  });
});

describe("mappedSettings marking the checks version 2 would call uncovered", () => {
  const MARKED_TEST_BODY_CHECKS = [
    { address: LOOP_KEYWORD_TEST_BODY, state: { state: "not-adopted" } },
    { address: REBINDING_TEST_BODY, state: { state: "not-adopted" } },
  ];

  it.each([
    { name: "run", choice: { state: "run", mechanism: AUDIT } as const, state: { state: "run", engine: "walker" } },
    { name: "marked not-run", choice: { state: "not-run" } as const, state: { state: "not-run" } },
  ])("writes not-adopted the checks of an unselected discipline that share a symptom with a clause $name", ({ choice, state }) => {
    expect(
      mappedSettings({ catalogues: CROSS_DISCIPLINE_CATALOGUES, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, choice]] } }),
    ).toEqual({
      outcome: "ok",
      value: {
        settings: { ...BASE_SETTINGS, checks: [{ address: SHARED_SYMPTOM_LOOPS_CHECK, state }, ...MARKED_TEST_BODY_CHECKS] },
        drops: [],
        markedNotAdopted: [
          { check: LOOP_KEYWORD_TEST_BODY, clause: TEST_BODY_CLAUSE, reason: "discipline-not-selected" },
          { check: REBINDING_TEST_BODY, clause: TEST_BODY_CLAUSE, reason: "discipline-not-selected" },
        ],
      },
    });
  });

  it("marks again over what the marking listed, until a marked clause's other symptoms reach no further unselected discipline", () => {
    const parameterReassignment = clauseAddressSchema.parse("CD-44#parameter-reassignment");
    const rebindingParameterReassignment: Check = { ...TEST_BODY_REBINDING_CHECK, name: "parameter-reassignment", clause: parameterReassignment };
    expect(
      mappedSettings({
        selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] },
        catalogues: [{ ruleSet: "hone", catalogue: { ...SETTINGS_CATALOGUE, checks: [...SETTINGS_CATALOGUE.checks, rebindingParameterReassignment] } }],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        settings: {
          ...BASE_SETTINGS,
          checks: [
            { address: SHARED_SYMPTOM_LOOPS_CHECK, state: { state: "run", engine: "walker" } },
            ...MARKED_TEST_BODY_CHECKS,
            { address: { ruleSet: "hone", check: "rebinding#parameter-reassignment" }, state: { state: "not-adopted" } },
          ],
        },
        drops: [],
        markedNotAdopted: [
          { check: LOOP_KEYWORD_TEST_BODY, clause: TEST_BODY_CLAUSE, reason: "discipline-not-selected" },
          { check: REBINDING_TEST_BODY, clause: TEST_BODY_CLAUSE, reason: "discipline-not-selected" },
          { check: { ruleSet: "hone", check: "rebinding#parameter-reassignment" }, clause: parameterReassignment, reason: "discipline-not-selected" },
        ],
      },
    });
  });

  it("never marks a check of a discipline version 1 selected, though version 2 would call it uncovered", () => {
    const otherTestClause = clauseAddressSchema.parse("CD-27#other-test-rule");
    const sameSymptomInSelectedDiscipline: Check = { ...LOOP_KEYWORD_LOOPS, name: "other-test-rule", clause: otherTestClause };
    expect(
      mappedSettings({
        selection: { ...BASE_SELECTION, clauses: [[TEST_BODY_CLAUSE, { state: "run", mechanism: AUDIT }]] },
        catalogues: [{ ruleSet: "hone", catalogue: { ...SETTINGS_CATALOGUE, checks: [...SETTINGS_CATALOGUE.checks, sameSymptomInSelectedDiscipline] } }],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        settings: {
          ...BASE_SETTINGS,
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "run", engine: "walker" } },
            { address: REBINDING_TEST_BODY, state: { state: "run", engine: "walker" } },
            { address: SHARED_SYMPTOM_LOOPS_CHECK, state: { state: "not-adopted" } },
          ],
        },
        drops: [],
        markedNotAdopted: [{ check: SHARED_SYMPTOM_LOOPS_CHECK, clause: LOOPS_CLAUSE, reason: "discipline-not-selected" }],
      },
    });
  });

  it("marks nothing when no listed check shares a symptom with an unlisted one", () => {
    expect(
      mappedSettings({
        catalogues: CROSS_DISCIPLINE_CATALOGUES,
        selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "not-adopted" }], [TEST_BODY_CLAUSE, { state: "not-adopted" }]] },
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        settings: {
          ...BASE_SETTINGS,
          checks: [
            { address: SHARED_SYMPTOM_LOOPS_CHECK, state: { state: "not-adopted" } },
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "not-adopted" } },
            { address: REBINDING_TEST_BODY, state: { state: "not-adopted" } },
          ],
        },
        drops: [],
        markedNotAdopted: [],
      },
    });
  });
});

describe("mappedSettings turning clauses into checks", () => {
  it("lists a clause run on a mechanism as its check, run by that check's engine on the mechanism", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] } }),
    ).toEqual(okWith({ settings: { checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }] } }));
  });

  it("lists one entry for each check of a clause that has two", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        selection: { ...BASE_SELECTION, clauses: [[TEST_BODY_CLAUSE, { state: "run", mechanism: AUDIT }]] },
      }),
    ).toEqual(
      okWith({
        settings: {
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "run", engine: "walker" } },
            { address: REBINDING_TEST_BODY, state: { state: "run", engine: "walker" } },
          ],
        },
      }),
    );
  });

  it("copies not-run to every check of the clause", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[TEST_BODY_CLAUSE, { state: "not-run" }]] } }),
    ).toEqual(
      okWith({
        settings: {
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "not-run" } },
            { address: REBINDING_TEST_BODY, state: { state: "not-run" } },
          ],
        },
      }),
    );
  });

  it("copies not-adopted to the check of the clause", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "not-adopted" }]] } }),
    ).toEqual(okWith({ settings: { checks: [{ address: LOOPS_CHECK, state: { state: "not-adopted" } }] } }));
  });

  it("refuses a clause with no check", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LAYERING_CLAUSE, { state: "not-run" }]] } }),
    ).toEqual({ outcome: "failed", error: [{ kind: "clause-without-check", clause: "CD-13#layering" }] });
  });

  it("refuses a check with no engine on the mechanism the clause was run on", () => {
    const oxlint = mechanismIdSchema.parse("oxlint");
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: oxlint }]] } }),
    ).toEqual({ outcome: "failed", error: [{ kind: "no-engine-on-mechanism", check: "loop-count#loops", mechanism: oxlint }] });
  });

  it("refuses a check with two engines on the mechanism, naming both", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        catalogues: TWO_ENGINE_CATALOGUES,
        selection: { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] },
      }),
    ).toEqual({
      outcome: "failed",
      error: [{ kind: "two-engines-on-mechanism", check: "loop-keyword#loops", mechanism: AUDIT, engines: ["walker", "second-walker"] }],
    });
  });
});

describe("mappedSettings carrying ESLint config roots", () => {
  it("carries a non-empty list over as it is", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, eslintConfigRoots: [repoPathSchema.parse("packages/a")] } })).toEqual(
      okWith({ settings: { eslintConfigRoots: [repoPathSchema.parse("packages/a")] } }),
    );
  });

  it("writes an empty list when version 1 listed none", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: { eslintConfigRoots: [] } }));
  });
});

describe("mappedSettings turning clauseSettings into checkSettings", () => {
  const LOOPS_RUN = { ...BASE_SELECTION, clauses: [[LOOPS_CLAUSE, { state: "run", mechanism: AUDIT }]] } satisfies ConsumerSelectionFile;

  it("gives a setting to the check of the clause under the version 2 name", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        selection: { ...LOOPS_RUN, clauseSettings: [[LOOPS_CLAUSE, { confinedPackages: ["eslint"], limit: 5 }]] },
      }),
    ).toEqual(
      okWith({
        settings: {
          checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }],
          checkSettings: [{ address: LOOPS_CHECK, values: { confinedOutsideDependencies: ["eslint"], limit: 5 } }],
        },
      }),
    );
  });

  it("gives the settings of a clause to every one of its checks", () => {
    expect(
      mappedSettings({
        ...BASE_REQUEST,
        selection: {
          ...BASE_SELECTION,
          clauses: [[TEST_BODY_CLAUSE, { state: "run", mechanism: AUDIT }]],
          clauseSettings: [[TEST_BODY_CLAUSE, { limit: 4 }]],
        },
      }),
    ).toEqual(
      okWith({
        settings: {
          checks: [
            { address: LOOP_KEYWORD_TEST_BODY, state: { state: "run", engine: "walker" } },
            { address: REBINDING_TEST_BODY, state: { state: "run", engine: "walker" } },
          ],
          checkSettings: [
            { address: LOOP_KEYWORD_TEST_BODY, values: { limit: 4 } },
            { address: REBINDING_TEST_BODY, values: { limit: 4 } },
          ],
        },
      }),
    );
  });

  it("copies the edition to the check's settings", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...LOOPS_RUN, clauseSettings: [[LOOPS_CLAUSE, { edition: "2" }]] } }),
    ).toEqual(
      okWith({
        settings: {
          checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }],
          checkSettings: [{ address: LOOPS_CHECK, values: { edition: "2" } }],
        },
      }),
    );
  });

  it("gives a setting the check may not declare as it is, leaving version 2's reader to refuse it", () => {
    expect(
      mappedSettings({ ...BASE_REQUEST, selection: { ...LOOPS_RUN, clauseSettings: [[LOOPS_CLAUSE, { colour: "red" }]] } }),
    ).toEqual(
      okWith({
        settings: {
          checks: [{ address: LOOPS_CHECK, state: { state: "run", engine: "walker" } }],
          checkSettings: [{ address: LOOPS_CHECK, values: { colour: "red" } }],
        },
      }),
    );
  });
});

describe("mappedSettings dropping what version 2 has no setting for", () => {
  it("names the optional file exception why-chains as dropped", () => {
    expect(mappedSettings({ ...BASE_REQUEST, selection: { ...BASE_SELECTION, fileExceptionWhyChains: "optional" } })).toEqual({
      outcome: "ok",
      value: { settings: BASE_SETTINGS, drops: [{ kind: "file-exception-why-chains", value: "optional" }], markedNotAdopted: [] },
    });
  });

  it("drops nothing for the required why-chains, which lose nothing", () => {
    expect(mappedSettings(BASE_REQUEST)).toEqual(okWith({ settings: {} }));
  });
});
