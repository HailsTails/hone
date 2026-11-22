import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../rule-set/clause-address.ts";
import { clauseIdOf } from "../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "./assessment-file.ts";

describe("ASSESSMENT_FILE_NAME", () => {
  it("is the file beside disciplines.json", () => {
    expect(ASSESSMENT_FILE_NAME).toBe("disciplines.assessment.md");
  });
});

describe("assessmentSectionHeading", () => {
  it.each([
    {
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-15"),
        clause: clauseIdOf("loops"),
      },
      heading: "## CD-15#loops",
    },
    {
      clause: {
        ruleSet: { name: ruleSetNameOf("team") },
        discipline: disciplineIdOf("TM-1"),
        clause: clauseIdOf("no-tmp-files"),
      },
      heading: "## team/TM-1#no-tmp-files",
    },
  ])(
    "is the level-2 heading $heading of its clause address as the report prints it",
    ({ clause, heading }) => {
      expect(assessmentSectionHeading({ clause })).toBe(heading);
    },
  );
});
