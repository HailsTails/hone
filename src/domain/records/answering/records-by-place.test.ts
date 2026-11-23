import { describe, expect, it } from "vitest";

import type { FoundCheck } from "../../language-layer/check-address.ts";
import type { Check, Recipe, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../rule-set/rule-set-name-of.ts";
import type { HoneRecord, PlacedRecord, SymptomReach } from "../hone-records/hone-record.ts";
import type { Site } from "./record-reach.ts";
import {
  answeredAt,
  answeredByPlaceOf,
  placedInRecordOrder,
  recordsByPlaceOf,
  recordsReachingSites,
} from "./records-by-place.ts";

const STUB_WITH_VIFN: Recipe = {
  ruleSet: "hone",
  name: "stub-with-vifn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "A stub states its answer.", standing: "accepted" },
};

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "Seen.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const OUTSIDE_IMPORT: Symptom = { ...CLAIMED_TYPE, name: "outside-import-past-a-boundary" };

const MOCKED: Symptom = {
  ...CLAIMED_TYPE,
  name: "module-or-global-patched",
  recipes: [STUB_WITH_VIFN],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  clause: {
    ruleSet: TOOL_RULE_SET,
    discipline: disciplineIdOf("CD-2"),
    clause: clauseIdOf("cast-expressions"),
  },
  engines: [{ name: "eslint" }],
  forms: [],
};

const NON_NULL_CHECK: Check = { ...CAST_CHECK, name: "non-null-assertions" };

const ADAPTER = repoPathOf("src/adapters/ids.ts");

const OTHER_ADAPTER = repoPathOf("src/adapters/files.ts");

const DOMAIN = repoPathOf("src/domain/order.ts");

const RECORDS_FILE = repoPathOf("hone-records/debt/claimed-type.json");

const placedOf = (request: {
  readonly record: HoneRecord;
  readonly index: number;
}): PlacedRecord => ({
  place: { file: RECORDS_FILE, index: request.index },
  record: request.record,
});

const debtAt = (request: {
  readonly file: RepoPath;
  readonly index: number;
  readonly reach: SymptomReach;
}): PlacedRecord =>
  placedOf({
    index: request.index,
    record: {
      kind: "debt",
      symptom: CLAIMED_TYPE,
      reach: request.reach,
      file: request.file,
      holding: { held: "stated" },
    },
  });

const siteAt = (request: {
  readonly file: RepoPath;
  readonly symptom: Symptom;
  readonly check: FoundCheck;
}): Site => ({ ...request, party: { reported: "not-reported" } });

const castSiteAt = (request: { readonly file: RepoPath }): Site =>
  siteAt({
    file: request.file,
    symptom: CLAIMED_TYPE,
    check: { found: "check", check: CAST_CHECK },
  });

const WHOLE_SYMPTOM: SymptomReach = { reaches: "whole-symptom" };

const ADAPTERS_BOUNDARY = placedOf({
  index: 0,
  record: {
    kind: "boundary-record",
    module: repoPathOf("src/adapters"),
    outsideParty: { kind: "package", specifier: "uuid", dependency: "uuid" },
    holding: { held: "stated", ports: ["Port"] },
  },
});

const DEPENDENCY = placedOf({
  index: 1,
  record: {
    kind: "dependency-record",
    dependency: "zod",
    nativeWay: "hand-written parsing",
    whyNotEnough: "Each adapter would repeat its checks.",
  },
});

const ADAPTER_DEBT = debtAt({ file: ADAPTER, index: 2, reach: WHOLE_SYMPTOM });

const ADAPTER_CAST_DEBT = debtAt({
  file: ADAPTER,
  index: 3,
  reach: { reaches: "one-check", check: CAST_CHECK },
});

const ADAPTER_NON_NULL_DEBT = debtAt({
  file: ADAPTER,
  index: 4,
  reach: { reaches: "one-check", check: NON_NULL_CHECK },
});

const OTHER_ADAPTER_DEBT = debtAt({ file: OTHER_ADAPTER, index: 5, reach: WHOLE_SYMPTOM });

const DOMAIN_DEBT = debtAt({ file: DOMAIN, index: 6, reach: WHOLE_SYMPTOM });

const DOMAIN_DEVIATION = placedOf({
  index: 7,
  record: {
    kind: "deviation",
    recipe: STUB_WITH_VIFN,
    file: DOMAIN,
    reasonFails: "The clock has no port yet.",
    evidence: "src/domain/order.ts:3",
    ruleHolds: "The stub stays in the test.",
  },
});

const RECORDS = [
  DOMAIN_DEBT,
  ADAPTER_NON_NULL_DEBT,
  ADAPTER_DEBT,
  DEPENDENCY,
  DOMAIN_DEVIATION,
  ADAPTERS_BOUNDARY,
  ADAPTER_CAST_DEBT,
  OTHER_ADAPTER_DEBT,
];

const BY_PLACE = recordsByPlaceOf({ records: RECORDS });

describe("recordsReachingSites", () => {
  it("gives the records at the site's file that reach its symptom or its check, in record order", () => {
    expect(
      recordsReachingSites({ byPlace: BY_PLACE, sites: [castSiteAt({ file: ADAPTER })] }),
    ).toEqual([ADAPTER_DEBT, ADAPTER_CAST_DEBT]);
  });

  it("gives only the records reaching the whole symptom for a site with no check", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [siteAt({ file: ADAPTER, symptom: CLAIMED_TYPE, check: { found: "none" } })],
      }),
    ).toEqual([ADAPTER_DEBT]);
  });

  it("gives a module record for a site under the module whose symptom it reaches", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [siteAt({ file: OTHER_ADAPTER, symptom: OUTSIDE_IMPORT, check: { found: "none" } })],
      }),
    ).toEqual([ADAPTERS_BOUNDARY]);
  });

  it("gives a deviation for a site whose symptom lists its recipe", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [siteAt({ file: DOMAIN, symptom: MOCKED, check: { found: "none" } })],
      }),
    ).toEqual([DOMAIN_DEVIATION]);
  });

  it("gives each record once, in record order, across sites", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [
          castSiteAt({ file: OTHER_ADAPTER }),
          castSiteAt({ file: ADAPTER }),
          castSiteAt({ file: DOMAIN }),
          castSiteAt({ file: ADAPTER }),
        ],
      }),
    ).toEqual([DOMAIN_DEBT, ADAPTER_DEBT, ADAPTER_CAST_DEBT, OTHER_ADAPTER_DEBT]);
  });

  it("gives nothing for a file no record is placed at", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [castSiteAt({ file: repoPathOf("README.md") })],
      }),
    ).toEqual([]);
  });
});

describe("recordsReachingSites, a team's symptom sharing a name with one of Hone's", () => {
  const TEAM_CLAIMED_TYPE: Symptom = { ...CLAIMED_TYPE, ruleSet: { name: ruleSetNameOf("acme") } };

  const TEAM_CAST_CHECK: Check = { ...CAST_CHECK, symptom: TEAM_CLAIMED_TYPE };

  const TEAM_DEBT = placedOf({
    index: 0,
    record: {
      kind: "debt",
      symptom: TEAM_CLAIMED_TYPE,
      reach: WHOLE_SYMPTOM,
      file: ADAPTER,
      holding: { held: "stated" },
    },
  });

  const TEAM_CAST_DEBT = placedOf({
    index: 1,
    record: {
      kind: "debt",
      symptom: TEAM_CLAIMED_TYPE,
      reach: { reaches: "one-check", check: TEAM_CAST_CHECK },
      file: ADAPTER,
      holding: { held: "stated" },
    },
  });

  const TEAM_BY_PLACE = recordsByPlaceOf({ records: [TEAM_DEBT, TEAM_CAST_DEBT] });

  it("gives the team's records for a site of the team's symptom", () => {
    expect(
      recordsReachingSites({
        byPlace: TEAM_BY_PLACE,
        sites: [
          siteAt({
            file: ADAPTER,
            symptom: TEAM_CLAIMED_TYPE,
            check: { found: "check", check: TEAM_CAST_CHECK },
          }),
        ],
      }),
    ).toEqual([TEAM_DEBT, TEAM_CAST_DEBT]);
  });

  it("gives none of the team's records for a site of Hone's symptom of the same name", () => {
    expect(
      recordsReachingSites({ byPlace: TEAM_BY_PLACE, sites: [castSiteAt({ file: ADAPTER })] }),
    ).toEqual([]);
  });

  it("gives none of Hone's records for a site of the team's symptom of the same name", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [
          siteAt({
            file: ADAPTER,
            symptom: TEAM_CLAIMED_TYPE,
            check: { found: "check", check: TEAM_CAST_CHECK },
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("gives no deviation from Hone's recipe for a site whose symptom lists a team's recipe of the same name", () => {
    const teamMocked: Symptom = {
      ...MOCKED,
      ruleSet: TEAM_CLAIMED_TYPE.ruleSet,
      recipes: [{ ...STUB_WITH_VIFN, ruleSet: TEAM_CLAIMED_TYPE.ruleSet }],
    };
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [siteAt({ file: DOMAIN, symptom: teamMocked, check: { found: "none" } })],
      }),
    ).toEqual([]);
  });

  it("gives no module record for a team's symptom named as one a boundary record reaches", () => {
    expect(
      recordsReachingSites({
        byPlace: BY_PLACE,
        sites: [
          siteAt({
            file: OTHER_ADAPTER,
            symptom: { ...OUTSIDE_IMPORT, ruleSet: { name: ruleSetNameOf("acme") } },
            check: { found: "none" },
          }),
        ],
      }),
    ).toEqual([]);
  });
});

describe("placedInRecordOrder", () => {
  it("orders records by record order and leaves out records the index was not built from", () => {
    expect(
      placedInRecordOrder({
        byPlace: recordsByPlaceOf({ records: [DOMAIN_DEBT, DEPENDENCY, OTHER_ADAPTER_DEBT] }),
        records: [OTHER_ADAPTER_DEBT, ADAPTER_DEBT, DEPENDENCY, DOMAIN_DEBT],
      }),
    ).toEqual([DOMAIN_DEBT, DEPENDENCY, OTHER_ADAPTER_DEBT]);
  });
});

describe("answeredAt", () => {
  const file = repoPathOf("src/a.ts");
  const other = repoPathOf("src/b.ts");
  const acme = { name: ruleSetNameOf("acme") };
  const byPlace = answeredByPlaceOf({
    answered: [
      { ruleSet: TOOL_RULE_SET, file, symptom: "claimed-type", check: "cast-expressions" },
      { ruleSet: TOOL_RULE_SET, file: other, symptom: "claimed-type" },
      { ruleSet: acme, file, symptom: "loop-keyword" },
    ],
  });

  it.each([
    {
      file,
      ruleSet: TOOL_RULE_SET,
      symptom: "claimed-type",
      address: "claimed-type#cast-expressions",
      expected: true,
    },
    {
      file,
      ruleSet: TOOL_RULE_SET,
      symptom: "claimed-type",
      address: "claimed-type#assertion",
      expected: false,
    },
    {
      file: other,
      ruleSet: TOOL_RULE_SET,
      symptom: "claimed-type",
      address: "claimed-type#assertion",
      expected: true,
    },
    {
      file: repoPathOf("src/c.ts"),
      ruleSet: TOOL_RULE_SET,
      symptom: "claimed-type",
      address: "claimed-type#cast-expressions",
      expected: false,
    },
    {
      file,
      ruleSet: acme,
      symptom: "claimed-type",
      address: "claimed-type#cast-expressions",
      expected: false,
    },
    { file, ruleSet: acme, symptom: "loop-keyword", address: "loop-keyword#loops", expected: true },
    {
      file,
      ruleSet: TOOL_RULE_SET,
      symptom: "loop-keyword",
      address: "loop-keyword#loops",
      expected: false,
    },
  ])(
    "checks the answer for $address of $ruleSet in $file",
    ({ file, ruleSet, symptom, address, expected }) => {
      expect(answeredAt({ byPlace, file, ruleSet, symptom, address })).toBe(expected);
    },
  );
});
