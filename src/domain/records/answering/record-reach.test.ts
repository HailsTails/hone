import { describe, expect, it } from "vitest";

import type { FoundCheck } from "../../language-layer/check-address.ts";
import type {
  Case,
  Check,
  Recipe,
  RecordKind,
  Symptom,
  SymptomCatalogue,
} from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type {
  AuthorisedLocation,
  BoundaryRecord,
  Debt,
  HoneRecord,
  RuntimeFacility,
  SymptomReach,
} from "../hone-records/hone-record.ts";
import type { WhyChain } from "../why-chain.ts";
import { holdsAt, type PartyReport, placesReachedBy } from "./record-reach.ts";

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

const AUTHORISED_LOCATION_KIND: RecordKind = {
  name: "authorised-location",
  title: "Authorised location",
  phrase: "an authorised location",
  todaysFormat: "authorised-location",
};

const DEBT_KIND: RecordKind = {
  name: "debt",
  title: "Debt",
  phrase: "debt",
  todaysFormat: "file-carve-out",
};

const ADAPTER_PER_OUTSIDE_PARTY: Recipe = {
  ruleSet: "hone",
  name: "adapter-per-outside-party",
  title: "Adapter per outside party",
  standing: "accepted",
  reason: { text: "One adapter holds each outside party.", standing: "accepted" },
};

const STUB_WITH_VIFN: Recipe = {
  ruleSet: "hone",
  name: "stub-with-vifn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "A stub states its answer.", standing: "accepted" },
};

const symptomOf = (request: {
  readonly name: string;
  readonly recipes: readonly Recipe[];
}): Symptom => ({
  ruleSet: "hone",
  name: request.name,
  title: request.name,
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: request.recipes,
  correctUses: [],
});

const DATE_USED_DIRECTLY = symptomOf({ name: "date-used-directly", recipes: [] });

const AMBIENT_RANDOMNESS = symptomOf({ name: "ambient-randomness", recipes: [] });

const PROCESS_GLOBAL = symptomOf({ name: "process-global-used-in-place", recipes: [] });

const TEXT_PAST_ITS_READER = symptomOf({
  name: "text-past-its-reader",
  recipes: [ADAPTER_PER_OUTSIDE_PARTY],
});

const OUTSIDE_IMPORT = symptomOf({
  name: "outside-import-past-a-boundary",
  recipes: [ADAPTER_PER_OUTSIDE_PARTY],
});

const LIBRARY_CLASS = symptomOf({
  name: "library-class-built-in-place",
  recipes: [ADAPTER_PER_OUTSIDE_PARTY],
});

const OUTSIDE_TYPE = symptomOf({
  name: "outside-type-in-a-signature",
  recipes: [ADAPTER_PER_OUTSIDE_PARTY],
});

const CLAIMED_TYPE = symptomOf({ name: "claimed-type", recipes: [] });

const DOUBLE_WITH_A_BODY = symptomOf({ name: "double-with-a-body", recipes: [STUB_WITH_VIFN] });

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
  symptoms: [
    DATE_USED_DIRECTLY,
    AMBIENT_RANDOMNESS,
    PROCESS_GLOBAL,
    TEXT_PAST_ITS_READER,
    OUTSIDE_IMPORT,
    LIBRARY_CLASS,
    OUTSIDE_TYPE,
    CLAIMED_TYPE,
    DOUBLE_WITH_A_BODY,
  ],
  clauses: [],
  checks: [],
  namedBans: [{ outsideDependency: "lodash" }],
};

const ADAPTER = repoPathOf("src/adapters/stripe-webhook.ts");

const OTHER_FILE = repoPathOf("src/orders/charge-order.ts");

const NOT_REPORTED: PartyReport = { reported: "not-reported" };

const reportedAs = (specifier: string): PartyReport => ({ reported: "specifier", specifier });

const RUNTIME_REACH: readonly { readonly facility: RuntimeFacility; readonly symptom: Symptom }[] =
  [
    { facility: "clock", symptom: DATE_USED_DIRECTLY },
    { facility: "random", symptom: AMBIENT_RANDOMNESS },
    { facility: "process", symptom: PROCESS_GLOBAL },
    { facility: "json", symptom: TEXT_PAST_ITS_READER },
  ];

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [],
  forms: [],
};

const NON_NULL_CHECK: Check = {
  name: "non-null-assertions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("non-null-assertions"),
  },
  engines: [],
  forms: [],
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

const AUTHORISED_LOCATION: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: ADAPTER,
  holding: {
    held: "carried",
    entry: { reason: "Kept." },
    lacks: ["case", "owes", "whyChain"],
    standing: "unjudged",
  },
};

const CAST_LOCATION: AuthorisedLocation = {
  ...AUTHORISED_LOCATION,
  reach: { reaches: "one-check", check: CAST_CHECK },
};

const UNKNOWN_CHECK_LOCATION: AuthorisedLocation = {
  ...AUTHORISED_LOCATION,
  reach: { reaches: "unknown-check", check: "cast-expressions-old" },
};

const AUTHORISED_LOCATION_OFF_THE_CATALOGUE: AuthorisedLocation = {
  kind: "authorised-location",
  symptom: CLAIMED_TYPE,
  reach: WHOLE_SYMPTOM,
  file: ADAPTER,
  holding: {
    held: "stated",
    owing: {
      matches: "not-the-catalogue",
      note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
    },
    whyChain: CAUSAL_WHY_CHAIN,
  },
};

const IMPORT_DEBT: Debt = { ...DEBT, symptom: OUTSIDE_IMPORT };

const IMPORT_LOCATION: AuthorisedLocation = { ...AUTHORISED_LOCATION, symptom: OUTSIDE_IMPORT };

const IMPORT_LOCATION_OFF_THE_CATALOGUE: AuthorisedLocation = {
  ...AUTHORISED_LOCATION_OFF_THE_CATALOGUE,
  symptom: OUTSIDE_IMPORT,
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

const boundaryOn = (request: {
  readonly module: RepoPath;
  readonly outsideParty: BoundaryRecord["outsideParty"];
}): HoneRecord => ({
  kind: "boundary-record",
  module: request.module,
  outsideParty: request.outsideParty,
  holding: { held: "stated", ports: ["Port"] },
});

const UUID_BOUNDARY = boundaryOn({
  module: repoPathOf("src/adapters/ids.ts"),
  outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" },
});

const FILES_BOUNDARY = boundaryOn({
  module: repoPathOf("src/adapters/files"),
  outsideParty: { kind: "scheme-module", specifier: "node:fs" },
});

const IDS_FILE = repoPathOf("src/adapters/ids.ts");

const READ_TEXT_FILE = repoPathOf("src/adapters/files/read-text.ts");

describe("holdsAt, debt and authorised locations", () => {
  it.each([
    { record: DEBT },
    { record: AUTHORISED_LOCATION },
    { record: AUTHORISED_LOCATION_OFF_THE_CATALOGUE },
  ])(
    "holds a $record.kind on its symptom at its exact file, whatever it claims beyond that",
    ({ record }) => {
      expect(
        holdsAt({
          record,
          site: { check: UNCHECKED, symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );

  it.each([
    { record: IMPORT_DEBT },
    { record: IMPORT_LOCATION },
    { record: IMPORT_LOCATION_OFF_THE_CATALOGUE },
  ])(
    "holds a $record.kind over a finding raised by an import of a named ban, since a ban never refuses debt or an authorised location",
    ({ record }) => {
      expect(
        holdsAt({
          record,
          site: {
            check: UNCHECKED,
            symptom: OUTSIDE_IMPORT,
            file: ADAPTER,
            party: reportedAs("lodash"),
          },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );

  it.each([{ record: DEBT }, { record: AUTHORISED_LOCATION }])(
    "does not hold a $record.kind on another symptom at its file",
    ({ record }) => {
      expect(
        holdsAt({
          record,
          site: {
            check: UNCHECKED,
            symptom: DOUBLE_WITH_A_BODY,
            file: ADAPTER,
            party: NOT_REPORTED,
          },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );

  it.each([
    { record: DEBT, file: OTHER_FILE },
    { record: AUTHORISED_LOCATION, file: OTHER_FILE },
    { record: DEBT, file: repoPathOf("src/adapters/stripe-webhook.ts.bak") },
    { record: AUTHORISED_LOCATION, file: repoPathOf("src/adapters/stripe-webhook.ts/inner.ts") },
  ])(
    "does not hold a $record.kind at $file, since its file never widens to a folder or a prefix",
    ({ record, file }) => {
      expect(
        holdsAt({
          record,
          site: { check: UNCHECKED, symptom: CLAIMED_TYPE, file, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );
});

describe("holdsAt, a team's symptom sharing a name with one of Hone's", () => {
  const ACME = { name: ruleSetNameOf("acme") };

  it("does not hold Hone's debt over the team's symptom of the same name", () => {
    expect(
      holdsAt({
        record: DEBT,
        site: {
          check: UNCHECKED,
          symptom: { ...CLAIMED_TYPE, ruleSet: ACME },
          file: ADAPTER,
          party: NOT_REPORTED,
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("holds the team's debt over the team's own symptom", () => {
    const symptom = { ...CLAIMED_TYPE, ruleSet: ACME };
    expect(
      holdsAt({
        record: { ...DEBT, symptom },
        site: { check: UNCHECKED, symptom, file: ADAPTER, party: NOT_REPORTED },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it("does not hold a boundary record over the team's symptom named as one its outside party reaches", () => {
    expect(
      holdsAt({
        record: UUID_BOUNDARY,
        site: {
          check: UNCHECKED,
          symptom: { ...OUTSIDE_IMPORT, ruleSet: ACME },
          file: IDS_FILE,
          party: reportedAs("uuid"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });
});

describe("holdsAt, deviations", () => {
  it("holds a deviation at its file on a symptom whose recipes include its recipe", () => {
    expect(
      holdsAt({
        record: DEVIATION,
        site: { check: UNCHECKED, symptom: DOUBLE_WITH_A_BODY, file: ADAPTER, party: NOT_REPORTED },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it("does not hold a deviation on a symptom whose recipes do not include its recipe", () => {
    expect(
      holdsAt({
        record: DEVIATION,
        site: { check: UNCHECKED, symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold Hone's deviation on a symptom whose recipes include only a team's recipe of the same name", () => {
    const acme = { name: ruleSetNameOf("acme") };
    expect(
      holdsAt({
        record: DEVIATION,
        site: {
          check: UNCHECKED,
          symptom: {
            ...DOUBLE_WITH_A_BODY,
            ruleSet: acme,
            recipes: [{ ...STUB_WITH_VIFN, ruleSet: acme }],
          },
          file: ADAPTER,
          party: NOT_REPORTED,
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold a deviation at another file", () => {
    expect(
      holdsAt({
        record: DEVIATION,
        site: {
          check: UNCHECKED,
          symptom: DOUBLE_WITH_A_BODY,
          file: OTHER_FILE,
          party: NOT_REPORTED,
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("holds a deviation over a finding raised by an import of a dependency that is not banned", () => {
    expect(
      holdsAt({
        record: ADAPTER_DEVIATION,
        site: {
          check: UNCHECKED,
          symptom: OUTSIDE_IMPORT,
          file: ADAPTER,
          party: reportedAs("uuid"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it.each([
    { specifier: "lodash" },
    { specifier: "lodash/fp" },
    { specifier: "npm:lodash@4" },
    { specifier: "LODASH" },
  ])(
    "does not hold a deviation over a finding raised by an import of $specifier, since no deviation makes a named ban correct",
    ({ specifier }) => {
      expect(
        holdsAt({
          record: ADAPTER_DEVIATION,
          site: {
            check: UNCHECKED,
            symptom: OUTSIDE_IMPORT,
            file: ADAPTER,
            party: reportedAs(specifier),
          },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );

  it.each([{ symptom: OUTSIDE_IMPORT }, { symptom: LIBRARY_CLASS }, { symptom: OUTSIDE_TYPE }])(
    "does not hold a deviation over $symptom.name when the finding does not report its outside party, since it may be a named ban",
    ({ symptom }) => {
      expect(
        holdsAt({
          record: ADAPTER_DEVIATION,
          site: { check: UNCHECKED, symptom, file: ADAPTER, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );
});

describe("holdsAt, boundary records", () => {
  it.each([
    { symptom: OUTSIDE_IMPORT, specifier: "uuid" },
    { symptom: LIBRARY_CLASS, specifier: "uuid" },
    { symptom: OUTSIDE_TYPE, specifier: "uuid/v4" },
  ])(
    "holds a boundary record on a package over $symptom.name of $specifier in its module",
    ({ symptom, specifier }) => {
      expect(
        holdsAt({
          record: UUID_BOUNDARY,
          site: { check: UNCHECKED, symptom, file: IDS_FILE, party: reportedAs(specifier) },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );

  it("holds a boundary record on a module its scheme names over an import of it in a file inside its module folder", () => {
    expect(
      holdsAt({
        record: FILES_BOUNDARY,
        site: {
          check: UNCHECKED,
          symptom: OUTSIDE_IMPORT,
          file: READ_TEXT_FILE,
          party: reportedAs("node:fs"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });

  it.each([
    { record: UUID_BOUNDARY, file: IDS_FILE, specifier: "nanoid" },
    { record: FILES_BOUNDARY, file: READ_TEXT_FILE, specifier: "lodash" },
    { record: FILES_BOUNDARY, file: READ_TEXT_FILE, specifier: "node:path" },
  ])(
    "does not hold a boundary record over an import of $specifier, another outside party, in its module",
    ({ record, file, specifier }) => {
      expect(
        holdsAt({
          record,
          site: { check: UNCHECKED, symptom: OUTSIDE_IMPORT, file, party: reportedAs(specifier) },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );

  it.each([
    { record: UUID_BOUNDARY, file: IDS_FILE },
    { record: FILES_BOUNDARY, file: READ_TEXT_FILE },
  ])(
    "does not hold a boundary record on $record.outsideParty.specifier over an import whose outside party is not reported",
    ({ record, file }) => {
      expect(
        holdsAt({
          record,
          site: { check: UNCHECKED, symptom: OUTSIDE_IMPORT, file, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );

  it("does not hold a boundary record in a file that only shares its module's name as a prefix", () => {
    expect(
      holdsAt({
        record: FILES_BOUNDARY,
        site: {
          check: UNCHECKED,
          symptom: OUTSIDE_IMPORT,
          file: repoPathOf("src/adapters/files-old.ts"),
          party: reportedAs("node:fs"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it.each(RUNTIME_REACH)(
    "holds a boundary record on runtime:$facility over $symptom.name in its module",
    ({ facility, symptom }) => {
      expect(
        holdsAt({
          record: boundaryOn({
            module: repoPathOf("src/adapters/world.ts"),
            outsideParty: { kind: "runtime", facility },
          }),
          site: {
            check: UNCHECKED,
            symptom,
            file: repoPathOf("src/adapters/world.ts"),
            party: NOT_REPORTED,
          },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );

  it.each(RUNTIME_REACH)(
    "does not hold a boundary record on runtime:$facility over an outside import",
    ({ facility }) => {
      expect(
        holdsAt({
          record: boundaryOn({
            module: repoPathOf("src/adapters/world.ts"),
            outsideParty: { kind: "runtime", facility },
          }),
          site: {
            check: UNCHECKED,
            symptom: OUTSIDE_IMPORT,
            file: repoPathOf("src/adapters/world.ts"),
            party: reportedAs("uuid"),
          },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );

  it("does not hold a boundary record on runtime:json over a symptom another facility reaches", () => {
    expect(
      holdsAt({
        record: boundaryOn({
          module: repoPathOf("src/adapters/json.ts"),
          outsideParty: { kind: "runtime", facility: "json" },
        }),
        site: {
          check: UNCHECKED,
          symptom: DATE_USED_DIRECTLY,
          file: repoPathOf("src/adapters/json.ts"),
          party: NOT_REPORTED,
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("does not hold a boundary record on a package over a symptom outside an outside party's reach", () => {
    expect(
      holdsAt({
        record: boundaryOn({
          module: repoPathOf("src/adapters/stripe-webhook.ts"),
          outsideParty: { kind: "package", specifier: "stripe", dependency: "stripe" },
        }),
        site: {
          check: UNCHECKED,
          symptom: CLAIMED_TYPE,
          file: ADAPTER,
          party: reportedAs("stripe"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });

  it("holds a boundary record on a named ban, since a ban refuses only a dependency record or a deviation", () => {
    expect(
      holdsAt({
        record: boundaryOn({
          module: repoPathOf("src/adapters/collections.ts"),
          outsideParty: { kind: "package", specifier: "lodash", dependency: "lodash" },
        }),
        site: {
          check: UNCHECKED,
          symptom: OUTSIDE_IMPORT,
          file: repoPathOf("src/adapters/collections.ts"),
          party: reportedAs("lodash/fp"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("holds");
  });
});

describe("holdsAt, dependency records", () => {
  it("holds nothing, since no check asks for a dependency record yet", () => {
    expect(
      holdsAt({
        record: {
          kind: "dependency-record",
          dependency: "zod",
          nativeWay: "hand-written parsing",
          whyNotEnough: "Each adapter would repeat its checks.",
        },
        site: {
          check: UNCHECKED,
          symptom: OUTSIDE_IMPORT,
          file: ADAPTER,
          party: reportedAs("zod"),
        },
        catalogue: CATALOGUE,
      }),
    ).toBe("does-not-hold");
  });
});

describe("holdsAt, a record that names one check of its symptom", () => {
  it.each([{ record: CAST_DEBT }, { record: CAST_LOCATION }])(
    "holds a $record.kind naming one check over that check's site",
    ({ record }) => {
      expect(
        holdsAt({
          record,
          site: { check: AT_CAST, symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );

  it.each([
    { record: CAST_DEBT, check: AT_NON_NULL },
    { record: CAST_LOCATION, check: AT_NON_NULL },
    { record: CAST_DEBT, check: UNCHECKED },
    { record: CAST_LOCATION, check: UNCHECKED },
  ])(
    "does not hold a $record.kind naming one check over a site of the symptom found $check.found",
    ({ record, check }) => {
      expect(
        holdsAt({
          record,
          site: { check, symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );

  it.each([
    { record: DEBT, check: AT_CAST },
    { record: DEBT, check: AT_NON_NULL },
    { record: DEBT, check: UNCHECKED },
    { record: AUTHORISED_LOCATION, check: AT_CAST },
    { record: AUTHORISED_LOCATION, check: AT_NON_NULL },
    { record: AUTHORISED_LOCATION, check: UNCHECKED },
  ])(
    "holds a $record.kind naming no check over every site of its symptom, here one found $check.found",
    ({ record, check }) => {
      expect(
        holdsAt({
          record,
          site: { check, symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("holds");
    },
  );
});

describe("holdsAt, an authorised location naming a check its symptom does not have", () => {
  it.each([{ check: AT_CAST }, { check: AT_NON_NULL }, { check: UNCHECKED }])(
    "holds no site of its symptom, here one found $check.found, and never widens to the whole symptom",
    ({ check }) => {
      expect(
        holdsAt({
          record: UNKNOWN_CHECK_LOCATION,
          site: { check, symptom: CLAIMED_TYPE, file: ADAPTER, party: NOT_REPORTED },
          catalogue: CATALOGUE,
        }),
      ).toBe("does-not-hold");
    },
  );
});

const IMPORT_CHECK: Check = {
  name: "import-or-require",
  symptom: OUTSIDE_IMPORT,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-19"),
    clause: clauseIdOf("import-boundaries"),
  },
  engines: [],
  forms: [],
};

const CATALOGUE_WITH_CHECKS: SymptomCatalogue = {
  ...CATALOGUE,
  checks: [CAST_CHECK, NON_NULL_CHECK, IMPORT_CHECK],
};

describe("placesReachedBy", () => {
  it("places a debt on a whole symptom at its file for every check of the symptom", () => {
    expect(placesReachedBy({ record: DEBT, catalogue: CATALOGUE_WITH_CHECKS })).toEqual([
      { check: CAST_CHECK, place: { at: "file", file: ADAPTER } },
      { check: NON_NULL_CHECK, place: { at: "file", file: ADAPTER } },
    ]);
  });

  it("places a debt that names one check at its file for that check alone", () => {
    expect(placesReachedBy({ record: CAST_DEBT, catalogue: CATALOGUE_WITH_CHECKS })).toEqual([
      { check: CAST_CHECK, place: { at: "file", file: ADAPTER } },
    ]);
  });

  it("places a deviation at its file for the checks of every symptom that has its recipe, imported-party symptoms included", () => {
    expect(
      placesReachedBy({ record: ADAPTER_DEVIATION, catalogue: CATALOGUE_WITH_CHECKS }),
    ).toEqual([{ check: IMPORT_CHECK, place: { at: "file", file: ADAPTER } }]);
  });

  it("places a boundary record at its module for the checks of the symptoms its outside party reaches", () => {
    expect(placesReachedBy({ record: UUID_BOUNDARY, catalogue: CATALOGUE_WITH_CHECKS })).toEqual([
      { check: IMPORT_CHECK, place: { at: "module", module: IDS_FILE } },
    ]);
  });

  it("places a dependency record nowhere", () => {
    const dependency: HoneRecord = {
      kind: "dependency-record",
      dependency: "zod",
      nativeWay: "by hand",
      whyNotEnough: "Each adapter would repeat its checks.",
    };
    expect(placesReachedBy({ record: dependency, catalogue: CATALOGUE_WITH_CHECKS })).toEqual([]);
  });
});
