import { describe, expect, it } from "vitest";
import { clauseAddressObjectSchema, clauseAddressSchema } from "./clause-address.ts";
import { clauseAddressText, sameClauseAddress, TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { disciplineIdOf } from "../../domain/rule-set/discipline-id-of.ts";
import { clauseIdOf } from "../../domain/rule-set/clause-id-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";

describe("clauseAddressSchema", () => {
  it("reads a text with no rule-set prefix as the shared rule set", () => {
    expect({ ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("no-class-syntax") }).toEqual({
      ruleSet: "hone",
      discipline: "CD-14",
      clause: "no-class-syntax",
    });
  });

  it("reads the hone prefix as the same address as no prefix", () => {
    expect({ ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") }).toEqual({ ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") });
  });

  it("reads shared as an ordinary team rule-set name", () => {
    expect({ ruleSet: { name: ruleSetNameOf("shared") }, discipline: disciplineIdOf("CD-14"), clause: clauseIdOf("no-class-syntax") }).toEqual({
      ruleSet: { name: "shared" },
      discipline: "CD-14",
      clause: "no-class-syntax",
    });
  });

  it("refuses an object that declares hone as a named rule set", () => {
    expect(
      clauseAddressObjectSchema.safeParse({ ruleSet: { name: "hone" }, discipline: "CD-14", clause: "no-class-syntax" }).success,
    ).toBe(false);
  });

  it("reads a prefixed text as that named rule set", () => {
    expect({ ruleSet: { name: ruleSetNameOf("probe") }, discipline: disciplineIdOf("PD-1"), clause: clauseIdOf("no-tmp-files") }).toEqual({
      ruleSet: { name: "probe" },
      discipline: "PD-1",
      clause: "no-tmp-files",
    });
  });

  it.each([
    "",
    "CD-14",
    "CD-14#",
    "#no-class-syntax",
    "cd-14#no-class-syntax",
    "CD-14#No-class",
    "CD-14#no-class#syntax",
    "CD-14 #no-class-syntax",
    "/CD-14#no-class-syntax",
    "Probe/CD-14#no-class-syntax",
    "probe/team/CD-14#no-class-syntax",
    "probe//CD-14#no-class-syntax",
    "Hone/CD-14#no-class-syntax",
  ])("refuses %j", (text) => {
    expect(clauseAddressSchema.safeParse(text).success).toBe(false);
  });

  it("refuses a value that is not text", () => {
    expect(
      clauseAddressSchema.safeParse({
        ruleSet: "hone",
        discipline: "CD-14",
        clause: "no-class-syntax",
      }).success,
    ).toBe(false);
  });
});

describe("clauseAddressText", () => {
  it("formats the hone prefix back to the bare form", () => {
    expect(clauseAddressText({ address: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") } })).toBe("CD-15#loops");
  });

  it.each(["CD-14#no-class-syntax", "probe/PD-1#no-tmp-files"])(
    "formats the address read from %j back to the same text",
    (text) => {
      expect(
        clauseAddressText({ address: clauseAddressSchema.parse(text) }),
      ).toBe(text);
    },
  );
});

describe("sameClauseAddress", () => {
  it("is same for the hone-prefixed and bare forms", () => {
    expect(
      sameClauseAddress({
        left: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") },
        right: { ruleSet: TOOL_RULE_SET, discipline: disciplineIdOf("CD-15"), clause: clauseIdOf("loops") },
      }),
    ).toBe("same");
  });

  it.each(["CD-14#no-class-syntax", "probe/PD-1#no-tmp-files"])(
    "is same for two separately read addresses of %j",
    (text) => {
      expect(
        sameClauseAddress({
          left: clauseAddressSchema.parse(text),
          right: clauseAddressSchema.parse(text),
        }),
      ).toBe("same");
    },
  );

  it.each([
    { part: "rule set", left: "CD-14#no-class-syntax", right: "probe/CD-14#no-class-syntax" },
    { part: "rule-set name", left: "probe/CD-14#no-class-syntax", right: "team/CD-14#no-class-syntax" },
    { part: "discipline", left: "CD-14#no-class-syntax", right: "CD-15#no-class-syntax" },
    { part: "clause", left: "CD-14#no-class-syntax", right: "CD-14#no-class-keyword" },
  ])("is different when the $part differs", ({ left, right }) => {
    expect(
      sameClauseAddress({
        left: clauseAddressSchema.parse(left),
        right: clauseAddressSchema.parse(right),
      }),
    ).toBe("different");
  });
});
