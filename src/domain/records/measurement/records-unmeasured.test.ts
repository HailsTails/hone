import { describe, expect, it } from "vitest";

import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import type { PlacedRecord } from "../hone-records/hone-record.ts";
import {
  carriedJudgementOf,
  unmeasuredCarriedRecords,
  unmeasuredDebtForfeiture,
} from "./records-unmeasured.ts";

const CLAIMED_TYPE: Symptom = {
  ruleSet: "hone",
  name: "claimed-type",
  title: "Claimed type",
  seen: "A cast.",
  mayIndicate: [],
  breachUsuallySits: "in the unit",
  recipes: [],
  correctUses: [],
};

const CAST_CHECK: Check = {
  name: "cast-expressions",
  symptom: CLAIMED_TYPE,
  page: "claimed-type/cast-expressions.md",
  engines: [],
  forms: [],
  findingSpecifics: [],
};

const FILE_A = repoPathOf("src/a.ts");

const STATED_DEBT: PlacedRecord = {
  place: { file: repoPathOf("hone-records/debt/claimed-type.json"), index: 0 },
  record: {
    kind: "debt",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "whole-symptom" },
    file: FILE_A,
    holding: { held: "stated" },
  },
};

const CARRIED_LOCATION: PlacedRecord = {
  place: { file: repoPathOf("hone-records/authorised-locations/claimed-type.json"), index: 0 },
  record: {
    kind: "authorised-location",
    symptom: CLAIMED_TYPE,
    reach: { reaches: "one-check", check: CAST_CHECK },
    file: FILE_A,
    holding: {
      binding: { binds: "check-and-file" },
      held: "carried",
      entry: { reason: "Kept." },
      lacks: ["case", "owes", "whyChain"],
      standing: "unjudged",
    },
  },
};

const ZOD_DEPENDENCY: PlacedRecord = {
  place: { file: repoPathOf("hone-records/dependency-records.json"), index: 0 },
  record: {
    kind: "dependency-record",
    dependency: "zod",
    nativeWay: "hand-written parsing",
    whyNotEnough: "Each adapter would repeat its checks.",
  },
};

describe("unmeasured records", () => {
  it("lists forfeiture unmeasured when the touched set is unmeasured and debt exists", () => {
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [STATED_DEBT],
      base: { measured: "yes", placements: [] },
      touched: { measured: "no", base: { state: "not-given" } },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([
      { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
    ]);
    expect(unmeasuredCarriedRecords(request)).toEqual([]);
  });

  it("lists import unmeasured when the base was not measured and a carried record exists, which still answers", () => {
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [CARRIED_LOCATION],
      base: {
        measured: "no",
        base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
      },
      touched: { measured: "yes", paths: new Set() },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([]);
    expect(unmeasuredCarriedRecords(request)).toEqual([
      {
        kind: "import-unmeasured",
        base: { state: "git-failed", revision: "main", gitMessage: "fatal: not a tree object" },
      },
    ]);
  });

  it("lists both kinds of unmeasured debt independently", () => {
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [STATED_DEBT, CARRIED_LOCATION],
      base: { measured: "no", base: { state: "not-given" } },
      touched: { measured: "no", base: { state: "not-given" } },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([
      { kind: "forfeiture-unmeasured", base: { state: "not-given" } },
    ]);
    expect(unmeasuredCarriedRecords(request)).toEqual([
      { kind: "import-unmeasured", base: { state: "not-given" } },
    ]);
  });

  it("lists nothing when nothing needs the base, though neither was measured", () => {
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [ZOD_DEPENDENCY],
      base: { measured: "no", base: { state: "not-given" } },
      touched: { measured: "no", base: { state: "not-given" } },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([]);
    expect(unmeasuredCarriedRecords(request)).toEqual([]);
  });

  it("lists nothing when forfeiture is measured elsewhere and the base was measured", () => {
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [STATED_DEBT, CARRIED_LOCATION],
      base: { measured: "yes", placements: [] },
      touched: { measured: "elsewhere" },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([]);
    expect(unmeasuredCarriedRecords(request)).toEqual([]);
  });

  it("lists nothing for a carried record when forfeiture is left to another run, though the base was not measured", () => {
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [STATED_DEBT, CARRIED_LOCATION],
      base: { measured: "no", base: { state: "not-given" } },
      touched: { measured: "elsewhere" },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([]);
    expect(unmeasuredCarriedRecords(request)).toEqual([]);
  });

  it("still lists import unmeasured when forfeiture is left to another run and the base was given but cannot be read", () => {
    const gitFailed = {
      state: "git-failed",
      revision: "origin/main",
      gitMessage: "fatal: bad object",
    } as const;
    const request: Parameters<typeof unmeasuredCarriedRecords>[0] = {
      records: [CARRIED_LOCATION],
      base: { measured: "no", base: gitFailed },
      touched: { measured: "elsewhere" },
    };

    expect(unmeasuredDebtForfeiture(request)).toEqual([]);
    expect(unmeasuredCarriedRecords(request)).toEqual([
      { kind: "import-unmeasured", base: gitFailed },
    ]);
  });
});

describe("carriedJudgementOf", () => {
  const NOT_GIVEN = { measured: "no", base: { state: "not-given" } } as const;

  const ELSEWHERE = { measured: "elsewhere" } as const;

  const THIS_RUN: TouchedSet = { measured: "yes", paths: new Set() };

  it("says nothing-carried when no record is carried, whatever the base", () => {
    expect(
      carriedJudgementOf({ records: [STATED_DEBT], base: NOT_GIVEN, touched: THIS_RUN }),
    ).toEqual({ judgement: "nothing-carried" });
  });

  it("says judged when the base was measured, whatever forfeiture does", () => {
    expect(
      carriedJudgementOf({
        records: [CARRIED_LOCATION],
        base: { measured: "yes", placements: [] },
        touched: ELSEWHERE,
      }),
    ).toEqual({ judgement: "judged" });
  });

  it("says unmeasured, naming the base, when carried records exist and no base was given while forfeiture is assessed in this run", () => {
    expect(
      carriedJudgementOf({ records: [CARRIED_LOCATION], base: NOT_GIVEN, touched: THIS_RUN }),
    ).toEqual({ judgement: "unmeasured", base: { state: "not-given" } });
  });

  it("says left-elsewhere, counting the carried records, only when no base was given and forfeiture is left to another run", () => {
    expect(
      carriedJudgementOf({ records: [CARRIED_LOCATION], base: NOT_GIVEN, touched: ELSEWHERE }),
    ).toEqual({ judgement: "left-elsewhere", carried: 1 });
  });
});
