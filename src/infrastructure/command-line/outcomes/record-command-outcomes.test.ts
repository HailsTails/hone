import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../domain/rule-set/discipline-id-of.ts";
import {
  inheritedDebtLine,
  pruneDebtCommandOutcome,
  splitRecordsCommandOutcome,
} from "./record-command-outcomes.ts";

const WALKER = "walker" as const;

describe("splitRecordsCommandOutcome", () => {
  it("prints each file written, then the file removed, and exits 0", () => {
    expect(
      splitRecordsCommandOutcome({
        result: {
          outcome: "ok",
          value: {
            effect: "split",
            writes: [
              {
                path: repoPathOf("discipline-exceptions/file-carve-outs/cd-19.json"),
                effect: "written",
              },
              { path: repoPathOf("discipline-exceptions.json"), effect: "removed" },
            ],
          },
        },
      }),
    ).toEqual({
      code: 0,
      text: "discipline-exceptions/file-carve-outs/cd-19.json written\ndiscipline-exceptions.json removed\n",
    });
  });

  it.each([
    {
      split: { effect: "already-split", path: repoPathOf("discipline-exceptions") },
      text: "discipline-exceptions already holds the records split: nothing to split\n",
    },
    {
      split: { effect: "no-records", path: repoPathOf("discipline-exceptions.json") },
      text: "discipline-exceptions.json holds no records: nothing to split\n",
    },
  ] as const)(
    "prints one line and exits 0 when there is nothing to split: $text",
    ({ split, text }) => {
      expect(splitRecordsCommandOutcome({ result: { outcome: "ok", value: split } })).toEqual({
        code: 0,
        text,
      });
    },
  );

  it("prints the load failure and exits 2 when the records cannot be split", () => {
    expect(
      splitRecordsCommandOutcome({
        result: {
          outcome: "failed",
          error: {
            kind: "records-unsplittable",
            path: "discipline-exceptions.json",
            detail: "exceptions[1] names no discipline",
          },
        },
      }),
    ).toEqual({
      code: 2,
      text: "load failure: records-unsplittable discipline-exceptions.json exceptions[1] names no discipline\n",
    });
  });
});

describe("inheritedDebtLine", () => {
  it("names the file that already holds the record", () => {
    expect(
      inheritedDebtLine({
        outcome: {
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-15"),
            clause: clauseIdOf("loops"),
          },
          file: repoPathOf("src/basket.ts"),
          effect: "already-recorded",
          heldIn: repoPathOf("discipline-exceptions/authorised-locations/cd-15.json"),
        },
      }),
    ).toBe(
      "CD-15#loops already-recorded src/basket.ts: discipline-exceptions/authorised-locations/cd-15.json already holds a record on this clause and file; the check says why it does not hold\n",
    );
  });

  it("tells a file under --leave to be recorded as an authorised location with a whyChain", () => {
    expect(
      inheritedDebtLine({
        outcome: {
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-15"),
            clause: clauseIdOf("loops"),
          },
          file: repoPathOf("src/clock.ts"),
          effect: "left",
          under: repoPathOf("src"),
        },
      }),
    ).toBe(
      "CD-15#loops left src/clock.ts: under --leave src; record it as an authorised-location with a whyChain, or fix it\n",
    );
  });

  it("tells a file the base revision does not hold to be fixed, since a carve-out on it is forfeited at once", () => {
    expect(
      inheritedDebtLine({
        outcome: {
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-15"),
            clause: clauseIdOf("loops"),
          },
          file: repoPathOf("src/new.ts"),
          effect: "new-file",
        },
      }),
    ).toBe(
      "CD-15#loops new-file src/new.ts: the base revision does not hold this file, so its debt was not inherited, and a file carve-out on it would be forfeited at once; fix it\n",
    );
  });

  it("names the folder whose configuration the file loads apart from the folder holding the disciplines.json a person would remove", () => {
    expect(
      inheritedDebtLine({
        outcome: {
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-15"),
            clause: clauseIdOf("loops"),
          },
          file: repoPathOf("nested/src/n.ts"),
          effect: "nested-configuration",
          under: repoPathOf("nested/src"),
          selectionFolder: repoPathOf("nested"),
          mechanism: "eslint",
        },
      }),
    ).toBe(
      "CD-15#loops nested-configuration nested/src/n.ts: the file loads the eslint configuration in nested/src, and nested holds its own disciplines.json; nested Hone configurations are not supported yet (https://github.com/HailsTails/hone/issues/72), so the eslint projection cannot put a record on this file into effect; fix it, or govern nested from this repository by removing nested/disciplines.json, then run record-debt again\n",
    );
  });
});

describe("pruneDebtCommandOutcome", () => {
  it("exits 0 and prints nothing when no debt is paid", () => {
    expect(pruneDebtCommandOutcome({ result: { outcome: "ok", value: [] } })).toEqual({
      code: 0,
      text: "",
    });
  });

  it("exits 0 and prints one <clause> removed <file> line per removed pair, in the order given", () => {
    expect(
      pruneDebtCommandOutcome({
        result: {
          outcome: "ok",
          value: [
            {
              clause: {
                ruleSet: TOOL_RULE_SET,
                discipline: disciplineIdOf("CD-14"),
                clause: clauseIdOf("class-syntax"),
              },
              file: repoPathOf("src/a.ts"),
            },
            {
              clause: {
                ruleSet: TOOL_RULE_SET,
                discipline: disciplineIdOf("CD-15"),
                clause: clauseIdOf("loops"),
              },
              file: repoPathOf("src/b.ts"),
            },
          ],
        },
      }),
    ).toEqual({
      code: 0,
      text: "CD-14#class-syntax removed src/a.ts\nCD-15#loops removed src/b.ts\n",
    });
  });

  it("exits 2 and prints the load failure line on a failure", () => {
    expect(
      pruneDebtCommandOutcome({
        result: { outcome: "failed", error: { kind: "runner-missing", mechanism: WALKER } },
      }),
    ).toEqual({
      code: 2,
      text: "load failure: runner-missing audit\n",
    });
  });
});
