import { describe, expect, it } from "vitest";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "./assessment-file.ts";
import { clauseAddressSchema } from "../discipline-exceptions-folder/clause-address.ts";

describe("ASSESSMENT_FILE_NAME", () => {
  it("is the file beside disciplines.json", () => {
    expect(ASSESSMENT_FILE_NAME).toBe("disciplines.assessment.md");
  });
});

describe("assessmentSectionHeading", () => {
  it.each([
    ["CD-15#loops", "## CD-15#loops"],
    ["hone/CD-15#loops", "## CD-15#loops"],
    ["team/TM-1#no-tmp-files", "## team/TM-1#no-tmp-files"],
  ])("is a level-2 heading of the clause address %s as the report prints it", (address, heading) => {
    expect(assessmentSectionHeading({ clause: clauseAddressSchema.parse(address) })).toBe(heading);
  });
});
