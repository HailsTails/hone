import { describe, expect, it } from "vitest";

import type { Recipe, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { RepoPath } from "../../repository/repo-path-types.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import type { PlacedRecord } from "./hone-record.ts";
import {
  movedPathRefusalsOf,
  recordsAtMovedPathsOf,
  recordsFollowingRenames,
} from "./records-following-renames.ts";

const CLAIMED_TYPE: Symptom = {
  ruleSet: TOOL_RULE_SET,
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const STUB_WITH_VI_FN: Recipe = {
  ruleSet: TOOL_RULE_SET,
  name: "stub-with-vi-fn",
  title: "Stub with vi.fn",
  standing: "accepted",
  reason: { text: "a stub answers without logic", standing: "accepted" },
};

const BASKET = repoPathOf("src/basket.ts");

const MOVED_BASKET = repoPathOf("src/basket/basket.ts");

const TOTAL = repoPathOf("src/total.ts");

const DEBT_ON_BASKET: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: BASKET,
    holding: { held: "stated" },
  },
};

const DEBT_ON_TOTAL: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 1 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: TOTAL,
    holding: { held: "stated" },
  },
};

const DEVIATION_ON_BASKET: PlacedRecord = {
  place: { file: repoPathOf("hone-records/deviations/stub-with-vi-fn.json"), index: 0 },
  record: {
    kind: "deviation",
    recipe: STUB_WITH_VI_FN,
    file: BASKET,
    reasonFails: "the stub needs state",
    evidence: "the basket counts its calls",
    ruleHolds: "the test still owns its double",
  },
};

const BOUNDARY_ON_BASKET: PlacedRecord = {
  place: { file: repoPathOf("hone-records/boundary-records/clock.json"), index: 0 },
  record: {
    kind: "boundary-record",
    module: BASKET,
    outsideParty: { kind: "runtime", facility: "clock" },
    holding: { held: "stated", ports: ["clock-port"] },
  },
};

const CHARGE = repoPathOf("src/charge.ts");

const debtAt = (request: { readonly index: number; readonly file: RepoPath }): PlacedRecord => ({
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: request.index },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: request.file,
    holding: { held: "stated" },
  },
});

describe("recordsFollowingRenames", () => {
  it("points each record named as moved at the path it moved to, leaving its place and every other record as it is", () => {
    expect(
      recordsFollowingRenames({
        records: [DEBT_ON_BASKET, DEBT_ON_TOTAL, DEVIATION_ON_BASKET, BOUNDARY_ON_BASKET],
        moved: [
          { place: DEBT_ON_BASKET.place, file: MOVED_BASKET },
          { place: DEVIATION_ON_BASKET.place, file: MOVED_BASKET },
        ],
      }),
    ).toEqual([
      {
        place: DEBT_ON_BASKET.place,
        record: {
          kind: "debt",
          symptom: CLAIMED_TYPE,
          reach: { reaches: "whole-symptom" },
          file: MOVED_BASKET,
          holding: { held: "stated" },
        },
      },
      DEBT_ON_TOTAL,
      {
        place: DEVIATION_ON_BASKET.place,
        record: {
          kind: "deviation",
          recipe: STUB_WITH_VI_FN,
          file: MOVED_BASKET,
          reasonFails: "the stub needs state",
          evidence: "the basket counts its calls",
          ruleHolds: "the test still owns its double",
        },
      },
      BOUNDARY_ON_BASKET,
    ]);
  });
});

const deviationAt = (request: {
  readonly index: number;
  readonly file: RepoPath;
}): PlacedRecord => ({
  place: { file: repoPathOf("hone-records/deviations/stub-with-vi-fn.json"), index: request.index },
  record: {
    kind: "deviation",
    recipe: STUB_WITH_VI_FN,
    file: request.file,
    reasonFails: "the stub needs state",
    evidence: "the basket counts its calls",
    ruleHolds: "the test still owns its double",
  },
});

describe("recordsAtMovedPathsOf", () => {
  it("names each record the base held at a path git saw renamed, with the path to repoint it to", () => {
    expect(
      recordsAtMovedPathsOf({
        records: [DEBT_ON_BASKET, DEBT_ON_TOTAL, DEVIATION_ON_BASKET, BOUNDARY_ON_BASKET],
        renamed: new Map([[MOVED_BASKET, { basePath: BASKET, content: "edited" }]]),
        held: [DEBT_ON_BASKET.record, DEBT_ON_TOTAL.record, DEVIATION_ON_BASKET.record],
      }),
    ).toEqual([
      { place: DEBT_ON_BASKET.place, file: MOVED_BASKET },
      { place: DEVIATION_ON_BASKET.place, file: MOVED_BASKET },
    ]);
  });

  it("names nothing when git saw no rename", () => {
    expect(
      recordsAtMovedPathsOf({
        records: [DEBT_ON_BASKET],
        renamed: new Map(),
        held: [DEBT_ON_BASKET.record],
      }),
    ).toEqual([]);
  });

  it("names a record whose place shifted since the base, after an entry ahead of it was pruned", () => {
    expect(
      recordsAtMovedPathsOf({
        records: [debtAt({ index: 0, file: BASKET })],
        renamed: new Map([[MOVED_BASKET, { basePath: BASKET, content: "unchanged" }]]),
        held: [debtAt({ index: 0, file: TOTAL }).record, debtAt({ index: 1, file: BASKET }).record],
      }),
    ).toEqual([{ place: debtAt({ index: 0, file: BASKET }).place, file: MOVED_BASKET }]);
  });

  it("names only the record still at the moved path when two records held the same file and one is repointed", () => {
    expect(
      recordsAtMovedPathsOf({
        records: [
          debtAt({ index: 0, file: MOVED_BASKET }),
          deviationAt({ index: 0, file: BASKET }),
        ],
        renamed: new Map([[MOVED_BASKET, { basePath: BASKET, content: "unchanged" }]]),
        held: [
          debtAt({ index: 0, file: BASKET }).record,
          deviationAt({ index: 0, file: BASKET }).record,
        ],
      }),
    ).toEqual([{ place: deviationAt({ index: 0, file: BASKET }).place, file: MOVED_BASKET }]);
  });

  it("names a record on the first path of a chain of renames, and not once it is repointed to the path the chain gave it", () => {
    const renamed = new Map([
      [TOTAL, { basePath: BASKET, content: "unchanged" as const }],
      [CHARGE, { basePath: TOTAL, content: "unchanged" as const }],
    ]);
    const held = [debtAt({ index: 0, file: BASKET }).record];
    expect({
      before: recordsAtMovedPathsOf({
        records: [debtAt({ index: 0, file: BASKET })],
        renamed,
        held,
      }),
      after: recordsAtMovedPathsOf({ records: [debtAt({ index: 0, file: TOTAL })], renamed, held }),
    }).toEqual({
      before: [{ place: debtAt({ index: 0, file: BASKET }).place, file: TOTAL }],
      after: [],
    });
  });

  it("names both records of two files that swapped paths, and neither once each is repointed", () => {
    const renamed = new Map([
      [TOTAL, { basePath: BASKET, content: "unchanged" as const }],
      [BASKET, { basePath: TOTAL, content: "unchanged" as const }],
    ]);
    const held = [
      debtAt({ index: 0, file: BASKET }).record,
      deviationAt({ index: 0, file: TOTAL }).record,
    ];
    expect({
      before: recordsAtMovedPathsOf({
        records: [debtAt({ index: 0, file: BASKET }), deviationAt({ index: 0, file: TOTAL })],
        renamed,
        held,
      }),
      after: recordsAtMovedPathsOf({
        records: [debtAt({ index: 0, file: TOTAL }), deviationAt({ index: 0, file: BASKET })],
        renamed,
        held,
      }),
    }).toEqual({
      before: [
        { place: debtAt({ index: 0, file: BASKET }).place, file: TOTAL },
        { place: deviationAt({ index: 0, file: TOTAL }).place, file: BASKET },
      ],
      after: [],
    });
  });
});

describe("movedPathRefusalsOf", () => {
  it("refuses each record held at a moved path, naming the path it moved to", () => {
    expect(
      movedPathRefusalsOf({ moved: [{ place: DEBT_ON_BASKET.place, file: MOVED_BASKET }] }),
    ).toEqual([
      {
        place: DEBT_ON_BASKET.place,
        refusals: [{ kind: "held-at-moved-path", movedTo: MOVED_BASKET }],
      },
    ]);
  });
});
