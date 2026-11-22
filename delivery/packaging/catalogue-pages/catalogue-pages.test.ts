import { describe, expect, it } from "vitest";
import { cataloguePagesOf } from "./catalogue-pages.ts";

const NAMES = { path: "src/infrastructure/disciplines-file/version-one-names.json", text: '{ "version": 1, "clauses": [], "recordKinds": {} }' };

const PRINCIPLE = { path: "rules/principles/one-place-decides.md", text: "# One place decides\n\n```json\n{}\n```\n\n- **Must hold:** One decision, one unit.\n" };

const README = { path: "rules/README.md", text: "# Rules\n\nNo item.\n" };

const OUTSIDE_RULES = { path: "docs/principles/elsewhere.md", text: "Not an item." };

describe("cataloguePagesOf", () => {
  it("renders the six pages from the item files under rules and the version 1 names", () => {
    expect(cataloguePagesOf({ files: [NAMES, README, PRINCIPLE, OUTSIDE_RULES] })).toEqual({
      outcome: "ok",
      value: [
        {
          path: "rules/principles.md",
          text: "# Principles\n\n## One place decides\n\n- **Must hold:** One decision, one unit.\n\n- **Rules under it:** none. The principle decides.\n",
        },
        { path: "rules/rules.md", text: "# Rules\n" },
        { path: "rules/cases.md", text: "# Cases\n" },
        { path: "rules/typescript/recipes.md", text: "# Recipes for TypeScript\n" },
        { path: "rules/typescript/symptoms.md", text: "# Symptoms in TypeScript\n" },
        { path: "rules/typescript/checks.md", text: "# Checks in TypeScript\n" },
      ],
    });
  });

  it("fails when the version 1 names are not among the files", () => {
    expect(cataloguePagesOf({ files: [PRINCIPLE] })).toEqual({
      outcome: "failed",
      error: "src/infrastructure/disciplines-file/version-one-names.json is not among the files",
    });
  });

  it("fails naming the file when an item has no facts", () => {
    expect(cataloguePagesOf({ files: [NAMES, { path: "rules/principles/one-place-decides.md", text: "# One place decides\n\nNo facts.\n" }] })).toEqual({
      outcome: "failed",
      error: "rules/principles/one-place-decides.md holds no fenced json block of facts",
    });
  });
});
