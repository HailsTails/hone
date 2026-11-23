import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../domain/rule-set/discipline-id-of.ts";
import {
  requestHeldOf,
  unrequestedClauseDetailOf,
  unrequestedDetailOf,
} from "./unrequested-entries.ts";

const HELD_CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-2"),
  clause: clauseIdOf("cast-expressions"),
};

const OTHER_CLAUSE = { ...HELD_CLAUSE, clause: clauseIdOf("non-null-assertions") };

const HELD_FILE = repoPathOf("src/a.ts");

const OTHER_FILE = repoPathOf("src/b.ts");

const HELD = requestHeldOf({ files: [HELD_FILE], clauses: [HELD_CLAUSE] });

describe("unrequestedDetailOf", () => {
  it("says nothing when every entry names a held clause in a held file", () => {
    expect(
      unrequestedDetailOf({
        noun: "a hit",
        entries: [{ clause: HELD_CLAUSE, file: HELD_FILE }],
        held: HELD,
      }),
    ).toEqual([]);
  });

  it("names the first entry in a file the request did not hold", () => {
    expect(
      unrequestedDetailOf({
        noun: "a hit",
        entries: [
          { clause: HELD_CLAUSE, file: HELD_FILE },
          { clause: HELD_CLAUSE, file: OTHER_FILE },
        ],
        held: HELD,
      }),
    ).toEqual(["a hit names CD-2#cast-expressions in src/b.ts, which the request did not hold"]);
  });

  it("names an entry whose clause the request did not hold", () => {
    expect(
      unrequestedDetailOf({
        noun: "a measured pair",
        entries: [{ clause: OTHER_CLAUSE, file: HELD_FILE }],
        held: HELD,
      }),
    ).toEqual([
      "a measured pair names CD-2#non-null-assertions in src/a.ts, which the request did not hold",
    ]);
  });
});

describe("unrequestedClauseDetailOf", () => {
  it("names an entry whose clause the request did not hold, whatever its file", () => {
    expect(
      unrequestedClauseDetailOf({
        noun: "a native exception",
        entries: [{ clause: HELD_CLAUSE }, { clause: OTHER_CLAUSE }],
        held: HELD,
      }),
    ).toEqual([
      "a native exception names CD-2#non-null-assertions, which the request did not hold",
    ]);
  });
});
