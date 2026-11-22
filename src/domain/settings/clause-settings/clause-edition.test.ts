import { describe, expect, it } from "vitest";
import { editionOf } from "../../rule-set/edition-of.ts";
import type { CheckEditions } from "./check-editions.ts";
import { settledClauseEdition } from "./clause-edition.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";

const ADDRESS = { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-27"), clause: clauseIdOf("test-body-logic") };
const TWO_EDITIONS = { declared: [editionOf("1"), editionOf("2")], default: editionOf("1"), latest: editionOf("2") };
const ONE_EDITION = { declared: [editionOf("1")], default: editionOf("1"), latest: editionOf("1") };

describe("settledClauseEdition", () => {
  it("runs the default edition when pinned and not given one", () => {
    expect(settledClauseEdition({ address: ADDRESS, editions: TWO_EDITIONS, pin: undefined, checkEditions: "pinned" })).toEqual({
      outcome: "ok",
      value: "1",
    });
  });

  it("runs the latest edition when the repository follows the latest", () => {
    expect(settledClauseEdition({ address: ADDRESS, editions: TWO_EDITIONS, pin: undefined, checkEditions: "latest" })).toEqual({
      outcome: "ok",
      value: "2",
    });
  });

  it.each<{ readonly checkEditions: CheckEditions; readonly pin: string; readonly ran: string }>([
    { checkEditions: "pinned", pin: "2", ran: "2" },
    { checkEditions: "latest", pin: "1", ran: "1" },
  ])("runs the clause's own edition $pin over checkEditions $checkEditions", ({ checkEditions, pin, ran }) => {
    expect(settledClauseEdition({ address: ADDRESS, editions: TWO_EDITIONS, pin, checkEditions })).toEqual({ outcome: "ok", value: ran });
  });

  it("refuses an edition the piece does not declare, naming those it does", () => {
    expect(settledClauseEdition({ address: ADDRESS, editions: TWO_EDITIONS, pin: "3", checkEditions: "pinned" })).toEqual({
      outcome: "failed",
      error: 'clauseSettings for CD-27#test-body-logic: edition must be one of "1", "2"',
    });
  });

  it("refuses an edition that is not text", () => {
    expect(settledClauseEdition({ address: ADDRESS, editions: ONE_EDITION, pin: 2, checkEditions: "pinned" })).toEqual({
      outcome: "failed",
      error: 'clauseSettings for CD-27#test-body-logic: edition must be one of "1"',
    });
  });
});
