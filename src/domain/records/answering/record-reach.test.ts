import { describe, expect, it } from "vitest";

import type { FoundCheck } from "../../language-layer/check-address.ts";
import type {
  Case,
  Check,
  Recipe,
  RecordKind,
  SymptomAddress,
  SymptomCatalogue,
  AuthorisedLocationKind,
  UnboundRecordKind,
} from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type {
  AuthorisedLocation,
  AuthorisedLocationLack,
  Carried,
  Debt,
  HoneRecord,
  OutsideParty,
  SymptomReach,
} from "../hone-records/hone-record.ts";
import type { WhyChain } from "../why-chain.ts";
import { type Holding, holdsAt, type PartyReport, placesReachedBy } from "./record-reach.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
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
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const AUTHORISED_LOCATION_KIND: AuthorisedLocationKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: UnboundRecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const ADAPTER_PER_OUTSIDE_PARTY: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "adapter-per-outside-party",
  title: "Adapter per outside party",
  standing: "accepted",
  reason: { text: "One adapter holds each outside party.", standing: "accepted" },
};

const STUB_WITH_VIFN: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "stub-with-vi-fn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "A stub states its answer.", standing: "accepted" },
};

const OUTSIDE_IMPORT: SymptomAddress = {
  ruleSet: TOOL_RULE_SET,
  name: "outside-import-past-a-boundary",
};

const LIBRARY_CLASS: SymptomAddress = {
  ruleSet: TOOL_RULE_SET,
  name: "library-class-built-in-place",
};

const CLAIMED_TYPE: SymptomAddress = { ruleSet: TOOL_RULE_SET, name: "claimed-type" };

const DOUBLE_WITH_A_BODY: SymptomAddress = { ruleSet: TOOL_RULE_SET, name: "double-with-a-body" };

const GIVES_A_VALUE_ITS_TYPE: Case = {
  name: "gives-a-value-its-type",
  title: "Gives a value its type",
  standing: "accepted",
  owes: [],
};

const CATALOGUE: SymptomCatalogue = {
  principles: [],
  rules: [],
  cases: [GIVES_A_VALUE_ITS_TYPE],
  recipes: [ADAPTER_PER_OUTSIDE_PARTY, STUB_WITH_VIFN],
  recordKinds: [AUTHORISED_LOCATION_KIND, DEBT_KIND],
  engines: [],
  symptoms: [],
  clauses: [],
  checks: [],
  namedBans: [{ outsideDependency: "lodash" }],
};

const ADAPTER = repoPathOf("src/adapters/stripe-webhook.ts");

const OTHER_FILE = repoPathOf("src/orders/charge-order.ts");

const NOT_REPORTED: PartyReport = { reported: "not-reported" };

const reportedAs = (specifier: string): PartyReport => ({ reported: "specifier", specifier });

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [],
  forms: [],
  findingSpecifics: [],
};

const NON_NULL_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/non-null-assertions.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("non-null-assertions"),
  },
  engines: [],
  forms: [],
  findingSpecifics: [],
};

const IMPORT_CHECK: Check = {
  name: "import-or-require",
  symptom: OUTSIDE_IMPORT,
  page: "outside-import-past-a-boundary/import-or-require.md",
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-19"),
    clause: clauseIdOf("import-boundaries"),
  },
  engines: [],
  forms: [],
  findingSpecifics: ["outside-party"],
};

const AT_CAST: FoundCheck = { found: "check", check: CAST_CHECK };

const AT_NON_NULL: FoundCheck = { found: "check", check: NON_NULL_CHECK };

const UNCHECKED: FoundCheck = { found: "none" };

const DEBT: Debt = {
  kind: "debt",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: ADAPTER,
  holding: { held: "stated" },
};

const CAST_DEBT: Debt = { ...DEBT, reach: { reaches: "one-check", check: CAST_CHECK } };

const CAST_LOCATION: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "one-check", check: CAST_CHECK },
  file: ADAPTER,
  holding: {
    binding: { binds: "check-and-file" },
    held: "carried",
    entry: { reason: "Kept." },
    lacks: ["case", "owes", "whyChain"],
    standing: "unjudged",
  },
};

const UNKNOWN_CHECK_LOCATION: AuthorisedLocation = {
  ...CAST_LOCATION,
  reach: { reaches: "unknown-check", check: "cast-expressions-old" },
};

const CAST_LOCATION_OFF_THE_CATALOGUE: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: { reaches: "one-check", check: CAST_CHECK },
  file: ADAPTER,
  holding: {
    binding: { binds: "check-and-file" },
    held: "stated",
    owing: {
      matches: "not-the-catalogue",
      note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
    },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const IMPORT_DEBT: Debt = { ...DEBT, symptom: OUTSIDE_IMPORT };

const CARRIED_HOLDING: Carried<AuthorisedLocationLack> = {
  held: "carried",
  entry: {},
  lacks: ["case", "owes", "whyChain"],
  standing: "unjudged",
};

const IMPORT_LOCATION: AuthorisedLocation = {
  ...CAST_LOCATION_OFF_THE_CATALOGUE,
  symptom: OUTSIDE_IMPORT,
  reach: { reaches: "one-check", check: IMPORT_CHECK },
  holding: {
    ...CARRIED_HOLDING,
    binding: {
      binds: "check-file-and-outside-party",
      outsideParty: { kind: "package", dependency: "zod" },
    },
  },
};

const DEVIATION: HoneRecord = {
  kind: "deviation",
  recipe: STUB_WITH_VIFN,
  file: ADAPTER,
  reasonFails: "The answers depend on earlier calls.",
  evidence: "Line 40.",
  ruleHolds: "Each answer is written out.",
};

const ADAPTER_DEVIATION: HoneRecord = { ...DEVIATION, recipe: ADAPTER_PER_OUTSIDE_PARTY };

type PartyRow = { readonly party: OutsideParty; readonly specifier: string };

type RecordRow = { readonly record: HoneRecord };

type HoldingRow = {
  readonly specifier: string;
  readonly recordParty: string;
  readonly holding: Holding;
};

type FoundCheckRow = { readonly check: FoundCheck };

describe("holdsAt, debt and authorised locations", () => {
  it.each([
    { record: CAST_DEBT },
    { record: CAST_LOCATION },
    { record: CAST_LOCATION_OFF_THE_CATALOGUE },
  ])(
    "holds a $record.kind on its check at its exact file, whatever it claims beyond that",
    ({ record }) => {
      const site = {
        check: AT_CAST,
        symptom: CLAIMED_TYPE,
        file: ADAPTER,
        party: NOT_REPORTED,
        recipes: [],
      };

      const holding = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(holding).toBe("holds");
    },
  );

  it.each<RecordRow>([{ record: DEBT }, { record: CAST_LOCATION }])(
    "does not hold a $record.kind on another symptom at its file",
    ({ record }) => {
      const site = {
        check: UNCHECKED,
        symptom: DOUBLE_WITH_A_BODY,
        file: ADAPTER,
        party: NOT_REPORTED,
        recipes: [STUB_WITH_VIFN],
      };

      const holding = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(holding).toBe("does-not-hold");
    },
  );

  it.each([
    { record: DEBT, file: OTHER_FILE },
    { record: CAST_LOCATION, file: OTHER_FILE },
    { record: DEBT, file: repoPathOf("src/adapters/stripe-webhook.ts.bak") },
    { record: CAST_LOCATION, file: repoPathOf("src/adapters/stripe-webhook.ts/inner.ts") },
  ])(
    "does not hold a $record.kind at $file, since its file never widens to a folder or a prefix",
    ({ record, file }) => {
      const site = {
        check: AT_CAST,
        symptom: CLAIMED_TYPE,
        file,
        party: NOT_REPORTED,
        recipes: [],
      };

      const holding = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(holding).toBe("does-not-hold");
    },
  );

  it("holds debt over a finding raised by an import of a named ban, since a ban never refuses debt", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const site = {
      check: atImport,
      symptom: OUTSIDE_IMPORT,
      file: ADAPTER,
      party: reportedAs("lodash"),
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: IMPORT_DEBT, site, catalogue: CATALOGUE });

    expect(holding).toBe("holds");
  });
});

describe("holdsAt, a team's symptom sharing a name with one of Hone's", () => {
  const ACME = { name: ruleSetNameOf("acme") };

  it("does not hold Hone's debt over the team's symptom of the same name", () => {
    const site = {
      check: UNCHECKED,
      symptom: { ...CLAIMED_TYPE, ruleSet: ACME },
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [],
    };

    const holding = holdsAt({ record: DEBT, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("holds the team's debt over the team's own symptom", () => {
    const symptom = { ...CLAIMED_TYPE, ruleSet: ACME };
    const site = { check: UNCHECKED, symptom, file: ADAPTER, party: NOT_REPORTED, recipes: [] };

    const holding = holdsAt({ record: { ...DEBT, symptom }, site, catalogue: CATALOGUE });

    expect(holding).toBe("holds");
  });

  it("does not hold Hone's authorised location bound to an outside party over the team's symptom of the same name", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const site = {
      check: atImport,
      symptom: { ...OUTSIDE_IMPORT, ruleSet: ACME },
      file: ADAPTER,
      party: reportedAs("zod"),
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: IMPORT_LOCATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });
});

describe("holdsAt, deviations", () => {
  it("holds a deviation at its file on a symptom whose recipes include its recipe", () => {
    const site = {
      check: UNCHECKED,
      symptom: DOUBLE_WITH_A_BODY,
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [STUB_WITH_VIFN],
    };

    const holding = holdsAt({ record: DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("holds");
  });

  it("does not hold a deviation on a symptom whose recipes do not include its recipe", () => {
    const site = {
      check: UNCHECKED,
      symptom: CLAIMED_TYPE,
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [],
    };

    const holding = holdsAt({ record: DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("does not hold Hone's deviation on a symptom whose recipes include only a team's recipe of the same name", () => {
    const acme = { name: ruleSetNameOf("acme") };
    const site = {
      check: UNCHECKED,
      symptom: { ...DOUBLE_WITH_A_BODY, ruleSet: acme },
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [{ ...STUB_WITH_VIFN, ruleSet: acme }],
    };

    const holding = holdsAt({ record: DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("does not hold a deviation at another file", () => {
    const site = {
      check: UNCHECKED,
      symptom: DOUBLE_WITH_A_BODY,
      file: OTHER_FILE,
      party: NOT_REPORTED,
      recipes: [STUB_WITH_VIFN],
    };

    const holding = holdsAt({ record: DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("holds a deviation over a finding raised by an import of a dependency that is not banned", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const site = {
      check: atImport,
      symptom: OUTSIDE_IMPORT,
      file: ADAPTER,
      party: reportedAs("uuid"),
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: ADAPTER_DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("holds");
  });

  it.each([
    { specifier: "lodash" },
    { specifier: "lodash/fp" },
    { specifier: "npm:lodash@4" },
    { specifier: "LODASH" },
  ])(
    "does not hold a deviation over a finding raised by an import of $specifier, since no deviation makes a named ban correct",
    ({ specifier }) => {
      const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
      const site = {
        check: atImport,
        symptom: OUTSIDE_IMPORT,
        file: ADAPTER,
        party: reportedAs(specifier),
        recipes: [ADAPTER_PER_OUTSIDE_PARTY],
      };

      const holding = holdsAt({ record: ADAPTER_DEVIATION, site, catalogue: CATALOGUE });

      expect(holding).toBe("does-not-hold");
    },
  );

  it("does not hold a deviation over a check that names an outside party when the finding does not report it, since it may be a named ban", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const site = {
      check: atImport,
      symptom: OUTSIDE_IMPORT,
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: ADAPTER_DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("holds a deviation over a check that names no outside party", () => {
    const site = {
      check: {
        found: "check",
        check: {
          name: "new-expression",
          symptom: LIBRARY_CLASS,
          page: "library-class-built-in-place/new-expression.md",
          engines: [],
          forms: [],
          findingSpecifics: [],
        },
      } satisfies FoundCheck,
      symptom: LIBRARY_CLASS,
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: ADAPTER_DEVIATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("holds");
  });
});

describe("holdsAt, an authorised location bound to an outside party", () => {
  it.each<PartyRow>([
    { party: { kind: "package", dependency: "zod" }, specifier: "zod" },
    { party: { kind: "package", dependency: "zod" }, specifier: "zod/v4" },
    { party: { kind: "package", dependency: "@scope/name" }, specifier: "@scope/name/client" },
    { party: { kind: "scheme", scheme: "node:" }, specifier: "node:fs" },
    { party: { kind: "scheme-module", specifier: "node:fs" }, specifier: "node:fs" },
    { party: { kind: "package", dependency: "lodash" }, specifier: "lodash/fp" },
  ])(
    "holds one bound to a $party.kind party over an import of $specifier at its check and file",
    ({ party, specifier }) => {
      const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
      const record: AuthorisedLocation = {
        ...IMPORT_LOCATION,
        holding: {
          ...CARRIED_HOLDING,
          binding: { binds: "check-file-and-outside-party", outsideParty: party },
        },
      };
      const site = {
        check: atImport,
        symptom: OUTSIDE_IMPORT,
        file: ADAPTER,
        party: reportedAs(specifier),
        recipes: [ADAPTER_PER_OUTSIDE_PARTY],
      };

      const holding = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(holding).toBe("holds");
    },
  );

  it.each<PartyRow>([
    { party: { kind: "package", dependency: "zod" }, specifier: "zod-extra" },
    { party: { kind: "scheme", scheme: "node:" }, specifier: "lodash" },
    { party: { kind: "scheme-module", specifier: "node:fs" }, specifier: "node:path" },
    { party: { kind: "scheme-module", specifier: "node:fs" }, specifier: "node:fs/promises" },
  ])(
    "does not hold one bound to a $party.kind party over an import of $specifier, another outside party",
    ({ party, specifier }) => {
      const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
      const record: AuthorisedLocation = {
        ...IMPORT_LOCATION,
        holding: {
          ...CARRIED_HOLDING,
          binding: { binds: "check-file-and-outside-party", outsideParty: party },
        },
      };
      const site = {
        check: atImport,
        symptom: OUTSIDE_IMPORT,
        file: ADAPTER,
        party: reportedAs(specifier),
        recipes: [ADAPTER_PER_OUTSIDE_PARTY],
      };

      const holding = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(holding).toBe("does-not-hold");
    },
  );

  it("does not hold over an import whose outside party is not reported", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const site = {
      check: atImport,
      symptom: OUTSIDE_IMPORT,
      file: ADAPTER,
      party: NOT_REPORTED,
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: IMPORT_LOCATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("does not hold over an import of its party in another file", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const site = {
      check: atImport,
      symptom: OUTSIDE_IMPORT,
      file: OTHER_FILE,
      party: reportedAs("zod"),
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: IMPORT_LOCATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it("does not hold over an import of its party at another check", () => {
    const site = {
      check: {
        found: "check",
        check: {
          name: "import-in-types",
          symptom: OUTSIDE_IMPORT,
          page: "outside-import-past-a-boundary/import-in-types.md",
          engines: [],
          forms: [],
          findingSpecifics: [],
        },
      } satisfies FoundCheck,
      symptom: OUTSIDE_IMPORT,
      file: ADAPTER,
      party: reportedAs("zod"),
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record: IMPORT_LOCATION, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });

  it.each<HoldingRow>([
    { specifier: "zod", recordParty: "zod", holding: "holds" },
    { specifier: "uuid", recordParty: "zod", holding: "does-not-hold" },
    { specifier: "zod", recordParty: "uuid", holding: "does-not-hold" },
    { specifier: "uuid", recordParty: "uuid", holding: "holds" },
  ])(
    "answers an import of $specifier by a record for $recordParty in the same file only when the party is its own",
    ({ specifier, recordParty, holding }) => {
      const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
      const record: AuthorisedLocation = {
        ...IMPORT_LOCATION,
        holding: {
          ...CARRIED_HOLDING,
          binding: {
            binds: "check-file-and-outside-party",
            outsideParty: { kind: "package", dependency: recordParty },
          },
        },
      };
      const site = {
        check: atImport,
        symptom: OUTSIDE_IMPORT,
        file: ADAPTER,
        party: reportedAs(specifier),
        recipes: [ADAPTER_PER_OUTSIDE_PARTY],
      };

      const held = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(held).toBe(holding);
    },
  );
});

describe("holdsAt, dependency records", () => {
  it("holds nothing, since no check asks for a dependency record yet", () => {
    const atImport: FoundCheck = { found: "check", check: IMPORT_CHECK };
    const record: HoneRecord = {
      kind: "dependency-record",
      dependency: "zod",
      nativeWay: "hand-written parsing",
      whyNotEnough: "Each adapter would repeat its checks.",
    };
    const site = {
      check: atImport,
      symptom: OUTSIDE_IMPORT,
      file: ADAPTER,
      party: reportedAs("zod"),
      recipes: [ADAPTER_PER_OUTSIDE_PARTY],
    };

    const holding = holdsAt({ record, site, catalogue: CATALOGUE });

    expect(holding).toBe("does-not-hold");
  });
});

describe("holdsAt, a record that names one check of its symptom", () => {
  it.each([
    { record: CAST_DEBT, check: AT_NON_NULL },
    { record: CAST_LOCATION, check: AT_NON_NULL },
    { record: CAST_DEBT, check: UNCHECKED },
    { record: CAST_LOCATION, check: UNCHECKED },
  ])(
    "does not hold a $record.kind naming one check over a site of the symptom found $check.found",
    ({ record, check }) => {
      const site = {
        check,
        symptom: CLAIMED_TYPE,
        file: ADAPTER,
        party: NOT_REPORTED,
        recipes: [],
      };

      const holding = holdsAt({ record, site, catalogue: CATALOGUE });

      expect(holding).toBe("does-not-hold");
    },
  );

  it.each<FoundCheckRow>([{ check: AT_CAST }, { check: AT_NON_NULL }, { check: UNCHECKED }])(
    "holds debt naming no check over every site of its symptom, here one found $check.found",
    ({ check }) => {
      const site = {
        check,
        symptom: CLAIMED_TYPE,
        file: ADAPTER,
        party: NOT_REPORTED,
        recipes: [],
      };

      const holding = holdsAt({ record: DEBT, site, catalogue: CATALOGUE });

      expect(holding).toBe("holds");
    },
  );
});

describe("holdsAt, an authorised location naming a check its symptom does not have", () => {
  it.each<FoundCheckRow>([{ check: AT_CAST }, { check: AT_NON_NULL }, { check: UNCHECKED }])(
    "holds no site of its symptom, here one found $check.found, and never widens to the whole symptom",
    ({ check }) => {
      const site = {
        check,
        symptom: CLAIMED_TYPE,
        file: ADAPTER,
        party: NOT_REPORTED,
        recipes: [],
      };

      const holding = holdsAt({ record: UNKNOWN_CHECK_LOCATION, site, catalogue: CATALOGUE });

      expect(holding).toBe("does-not-hold");
    },
  );
});

const CATALOGUE_WITH_CHECKS: SymptomCatalogue = {
  ...CATALOGUE,
  checks: [CAST_CHECK, NON_NULL_CHECK, IMPORT_CHECK],
};

describe("placesReachedBy", () => {
  it("places a debt on a whole symptom at its file for every check of the symptom", () => {
    const content = { symptoms: new Map<string, { readonly recipes: readonly Recipe[] }>() };

    const places = placesReachedBy({ record: DEBT, catalogue: CATALOGUE_WITH_CHECKS, content });

    expect(places).toEqual({
      outcome: "ok",
      value: [
        { check: CAST_CHECK, file: ADAPTER },
        { check: NON_NULL_CHECK, file: ADAPTER },
      ],
    });
  });

  it("places a debt that names one check at its file for that check alone", () => {
    const content = { symptoms: new Map<string, { readonly recipes: readonly Recipe[] }>() };

    const places = placesReachedBy({
      record: CAST_DEBT,
      catalogue: CATALOGUE_WITH_CHECKS,
      content,
    });

    expect(places).toEqual({ outcome: "ok", value: [{ check: CAST_CHECK, file: ADAPTER }] });
  });

  it("places an authorised location bound to an outside party at its file for its check alone", () => {
    const content = { symptoms: new Map<string, { readonly recipes: readonly Recipe[] }>() };

    const places = placesReachedBy({
      record: IMPORT_LOCATION,
      catalogue: CATALOGUE_WITH_CHECKS,
      content,
    });

    expect(places).toEqual({ outcome: "ok", value: [{ check: IMPORT_CHECK, file: ADAPTER }] });
  });

  it("places a deviation at its file for the checks of every symptom that has its recipe", () => {
    const content = {
      symptoms: new Map([
        ["claimed-type", { recipes: [] }],
        ["outside-import-past-a-boundary", { recipes: [ADAPTER_PER_OUTSIDE_PARTY] }],
      ]),
    };

    const places = placesReachedBy({
      record: ADAPTER_DEVIATION,
      catalogue: CATALOGUE_WITH_CHECKS,
      content,
    });

    expect(places).toEqual({ outcome: "ok", value: [{ check: IMPORT_CHECK, file: ADAPTER }] });
  });

  it("refuses to place a deviation when a check names a symptom the content does not hold", () => {
    const content = { symptoms: new Map([["claimed-type", { recipes: [] }]]) };

    const places = placesReachedBy({
      record: ADAPTER_DEVIATION,
      catalogue: CATALOGUE_WITH_CHECKS,
      content,
    });

    expect(places).toEqual({
      outcome: "failed",
      error: {
        kind: "symptom-unheld",
        symptom: { ruleSet: TOOL_RULE_SET, name: "outside-import-past-a-boundary" },
      },
    });
  });

  it("places a dependency record nowhere", () => {
    const dependency: HoneRecord = {
      kind: "dependency-record",
      dependency: "zod",
      nativeWay: "by hand",
      whyNotEnough: "Each adapter would repeat its checks.",
    };
    const content = { symptoms: new Map<string, { readonly recipes: readonly Recipe[] }>() };

    const places = placesReachedBy({
      record: dependency,
      catalogue: CATALOGUE_WITH_CHECKS,
      content,
    });

    expect(places).toEqual({ outcome: "ok", value: [] });
  });
});
