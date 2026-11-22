import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { checkTodayOf } from "./check-today.ts";

type Symptom = CatalogueFile["symptoms"][number];

const CHECKED: Symptom = {
  name: "checked",
  title: "Checked",
  group: "Group",
  seen: "A thing seen.",
  mayIndicate: [{ case: "does-one-job", points: [{ principle: "one-place-decides" }] }],
  breachUsuallySits: "in the unit",
  seenBy: ["syntax"],
  recipes: [],
  correctUses: [],
};

const PERSON_FIRST: Symptom = { ...CHECKED, name: "person-first", title: "Person first", seenBy: ["person", "types"] };

const REVIEWED: Symptom = { ...CHECKED, name: "reviewed", title: "Reviewed", seenBy: ["types"] };

const SEEN_ONLY_BY_A_CHECKED_CLAUSE: Symptom = { ...CHECKED, name: "seen-only-by-a-checked-clause", title: "Seen only by a checked clause" };

const UNSEEN: Symptom = { ...CHECKED, name: "unseen", title: "Unseen" };

const FILE: CatalogueFile = {
  version: 1,
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [],
  symptoms: [CHECKED, PERSON_FIRST, REVIEWED, SEEN_ONLY_BY_A_CHECKED_CLAUSE, UNSEEN],
  clauses: [
    {
      clause: clauseAddressSchema.parse("CD-1#checked-clause"),
      sight: { kind: "symptom-by-form", forms: [{ section: "Form", symptom: "seen-only-by-a-checked-clause" }] },
    },
    { clause: clauseAddressSchema.parse("CD-2#review-clause"), sight: { kind: "method", recipe: "composition-root", outcomeSeenBy: ["reviewed", "person-first"] } },
  ],
  checks: [{ symptom: "checked", name: "a-check", clause: clauseAddressSchema.parse("CD-1#checked-clause"), engines: ["walker"] }],
  namedBans: [],
};

describe("checkTodayOf", () => {
  it("reuses a check the symptom already has", () => {
    expect(checkTodayOf({ file: FILE, symptom: CHECKED })).toBe("reuse");
  });

  it("leaves to review alone a symptom a person sees first, even when a clause sees it", () => {
    expect(checkTodayOf({ file: FILE, symptom: PERSON_FIRST })).toBe("only review");
  });

  it("reviews a symptom that a clause with no check sees", () => {
    expect(checkTodayOf({ file: FILE, symptom: REVIEWED })).toBe("review");
  });

  it("needs a new check for a symptom seen only by a clause that has a check", () => {
    expect(checkTodayOf({ file: FILE, symptom: SEEN_ONLY_BY_A_CHECKED_CLAUSE })).toBe("new");
  });

  it("needs a new check for a symptom no clause sees", () => {
    expect(checkTodayOf({ file: FILE, symptom: UNSEEN })).toBe("new");
  });
});
