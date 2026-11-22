import { describe, expect, it } from "vitest";

import {
  SECTION_NAMES,
  type SectionName,
  sectionRoleOf,
  sectionsWithRole,
} from "./section-roles.ts";

describe("SECTION_NAMES", () => {
  it("names every report section once, in the order the report prints them", () => {
    expect(SECTION_NAMES).toEqual([
      "excluded",
      "notAdopted",
      "notRun",
      "editions",
      "findings",
      "exempted",
      "uncovered",
      "stale",
      "forfeited",
      "unrecorded",
      "doublyHeld",
      "invalidRecords",
      "unmeasured",
      "projectionProblems",
      "assessment",
      "readFirst",
    ]);
  });
});

describe("sectionRoleOf", () => {
  it.each<SectionName>(["excluded", "notAdopted", "notRun", "editions", "exempted", "assessment"])(
    "is informational for %s, which never fails the run",
    (section) => {
      expect(sectionRoleOf({ section })).toBe("informational");
    },
  );

  it.each<SectionName>([
    "findings",
    "uncovered",
    "stale",
    "forfeited",
    "unrecorded",
    "doublyHeld",
    "invalidRecords",
    "unmeasured",
    "projectionProblems",
  ])("is failing for %s, which fails the run when it has an entry", (section) => {
    expect(sectionRoleOf({ section })).toBe("failing");
  });

  it("is guidance for readFirst, which never fails the run and is printed beside the failures", () => {
    expect(sectionRoleOf({ section: "readFirst" })).toBe("guidance");
  });
});

describe("sectionsWithRole", () => {
  it("lists the nine failing sections in print order", () => {
    expect(sectionsWithRole({ role: "failing" })).toEqual([
      "findings",
      "uncovered",
      "stale",
      "forfeited",
      "unrecorded",
      "doublyHeld",
      "invalidRecords",
      "unmeasured",
      "projectionProblems",
    ]);
  });

  it("lists the six informational sections in print order", () => {
    expect(sectionsWithRole({ role: "informational" })).toEqual([
      "excluded",
      "notAdopted",
      "notRun",
      "editions",
      "exempted",
      "assessment",
    ]);
  });
});
