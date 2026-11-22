import { describe, expect, it } from "vitest";

import { changeEntryOf, conventionalSubjectOf } from "./conventional-subject.ts";

describe("conventionalSubjectOf", () => {
  it("reads a type and a description", () => {
    expect(conventionalSubjectOf({ subject: "feat: add a release script" })).toEqual({
      outcome: "ok",
      value: {
        type: "feat",
        scope: undefined,
        compatibility: "compatible",
        description: "add a release script",
      },
    });
  });

  it("reads a scope and the breaking marker", () => {
    expect(
      conventionalSubjectOf({ subject: "fix(eslint)!: rename the plugin namespace (#21)" }),
    ).toEqual({
      outcome: "ok",
      value: {
        type: "fix",
        scope: "eslint",
        compatibility: "breaking",
        description: "rename the plugin namespace (#21)",
      },
    });
  });

  it.each([
    "feat",
    "fix",
    "perf",
    "revert",
    "docs",
    "refactor",
    "test",
    "build",
    "ci",
    "chore",
    "style",
  ])("accepts the type %s", (type) => {
    expect(conventionalSubjectOf({ subject: `${type}: change something` }).outcome).toBe("ok");
  });

  it("refuses a type outside the list", () => {
    expect(conventionalSubjectOf({ subject: "feature: add a release script" })).toEqual({
      outcome: "failed",
      error: { kind: "unknown-type", type: "feature" },
    });
  });

  it.each([
    "Keep versions out of the docs (#20)",
    "Feat: add a release script",
    "feat:add a release script",
    "feat: ",
    "feat:  add a release script",
    "feat(): add a release script",
    "feat(Eslint): add a release script",
  ])("refuses %j, which is not shaped type(scope)!: description", (subject) => {
    expect(conventionalSubjectOf({ subject })).toEqual({
      outcome: "failed",
      error: { kind: "unshaped" },
    });
  });
});

describe("changeEntryOf", () => {
  it("reads a conventional subject from the message's first line", () => {
    expect(changeEntryOf({ message: "docs: explain the policy\n\nThe body says more." })).toEqual({
      kind: "conventional",
      subject: {
        type: "docs",
        scope: undefined,
        compatibility: "compatible",
        description: "explain the policy",
      },
    });
  });

  it.each(["BREAKING CHANGE: the flag is gone", "BREAKING-CHANGE: the flag is gone"])(
    "reads a %j footer as breaking",
    (footer) => {
      expect(
        changeEntryOf({ message: `fix(cli): drop a flag (#40)\n\nWhy.\n\n${footer}` }),
      ).toEqual({
        kind: "conventional",
        subject: {
          type: "fix",
          scope: "cli",
          compatibility: "breaking",
          description: "drop a flag (#40)",
        },
      });
    },
  );

  it("does not read the words in the subject or in running text as a footer", () => {
    expect(
      changeEntryOf({
        message: "fix: explain BREAKING CHANGE: footers\n\nA line about a BREAKING CHANGE: here.",
      }),
    ).toEqual({
      kind: "conventional",
      subject: {
        type: "fix",
        scope: undefined,
        compatibility: "compatible",
        description: "explain BREAKING CHANGE: footers",
      },
    });
  });

  it("keeps any other subject whole, as unclassified", () => {
    expect(changeEntryOf({ message: "Keep versions out of the docs (#20)\n\nBody." })).toEqual({
      kind: "unclassified",
      subject: "Keep versions out of the docs (#20)",
      compatibility: "compatible",
    });
  });

  it("marks an unclassified subject with a breaking footer as breaking", () => {
    expect(
      changeEntryOf({
        message: "Merge pull request #7 from a/branch\n\nBREAKING CHANGE: renamed a key",
      }),
    ).toEqual({
      kind: "unclassified",
      subject: "Merge pull request #7 from a/branch",
      compatibility: "breaking",
    });
  });
});
