import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../../../src/domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../src/domain/rule-set/discipline-id-of.ts";
import type {
  CatalogueFile,
  SymptomWire,
} from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { checkTodayOf } from "./check-today.ts";

const CHECKED: SymptomWire = {
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

const PERSON_FIRST: SymptomWire = {
  ...CHECKED,
  name: "person-first",
  title: "Person first",
  seenBy: ["person", "types"],
};

const REVIEWED: SymptomWire = {
  ...CHECKED,
  name: "reviewed",
  title: "Reviewed",
  seenBy: ["types"],
};

const SEEN_ONLY_BY_A_CHECKED_CLAUSE: SymptomWire = {
  ...CHECKED,
  name: "seen-only-by-a-checked-clause",
  title: "Seen only by a checked clause",
};

const UNSEEN: SymptomWire = { ...CHECKED, name: "unseen", title: "Unseen" };

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
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-1"),
        clause: clauseIdOf("checked-clause"),
      },
      sight: {
        kind: "symptom-by-form",
        forms: [{ form: "Form", symptom: "seen-only-by-a-checked-clause" }],
      },
    },
    {
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-2"),
        clause: clauseIdOf("review-clause"),
      },
      sight: {
        kind: "method",
        recipe: "composition-root",
        outcomeSeenBy: ["reviewed", "person-first"],
      },
    },
  ],
  checks: [
    {
      symptom: "checked",
      name: "a-check",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-1"),
        clause: clauseIdOf("checked-clause"),
      },
    },
  ],
  namedBans: [],
};

describe("checkTodayOf", () => {
  it("reuses a check the symptom already has", () => {
    expect(checkTodayOf({ file: FILE, symptom: CHECKED })).toBe("reuse");
  });

  it("is partial when every check the symptom has states what it misses", () => {
    const file: CatalogueFile = {
      ...FILE,
      checks: [
        {
          symptom: "checked",
          name: "a-check",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-1"),
            clause: clauseIdOf("checked-clause"),
          },
          misses: "the `let` form.",
        },
      ],
    };
    expect(checkTodayOf({ file, symptom: CHECKED })).toBe("partial");
  });

  it("reuses the checks when one of them misses nothing, though another states a miss", () => {
    const file: CatalogueFile = {
      ...FILE,
      checks: [
        {
          symptom: "checked",
          name: "a-check",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-1"),
            clause: clauseIdOf("checked-clause"),
          },
          misses: "the `let` form.",
        },
        {
          symptom: "checked",
          name: "b-check",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-1"),
            clause: clauseIdOf("checked-clause"),
          },
        },
      ],
    };
    expect(checkTodayOf({ file, symptom: CHECKED })).toBe("reuse");
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
