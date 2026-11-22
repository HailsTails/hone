import { describe, expect, it } from "vitest";
import { isClauseId, isDisciplineId, isRuleSetName } from "./identifiers.ts";

describe("isRuleSetName", () => {
  it.each(["team", "team-a", "a1"])("accepts %j", (text) => {
    expect(isRuleSetName(text)).toBe(true);
  });

  it.each(["", "Team", "1a", "team_a", "team/a"])("refuses %j", (text) => {
    expect(isRuleSetName(text)).toBe(false);
  });
});

describe("isDisciplineId", () => {
  it.each(["CD-14", "CD-14a", "ABCD-1"])("accepts %j", (text) => {
    expect(isDisciplineId(text)).toBe(true);
  });

  it.each(["", "cd-14", "C-1", "ABCDE-1", "CD-", "CD-1ab"])("refuses %j", (text) => {
    expect(isDisciplineId(text)).toBe(false);
  });
});

describe("isClauseId", () => {
  it.each(["class-syntax", "a", "cast-expressions2"])("accepts %j", (text) => {
    expect(isClauseId(text)).toBe(true);
  });

  it.each(["", "Class", "2fast", "class syntax", "class_syntax"])("refuses %j", (text) => {
    expect(isClauseId(text)).toBe(false);
  });
});
