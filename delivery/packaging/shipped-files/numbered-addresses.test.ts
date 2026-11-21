import { describe, expect, it } from "vitest";
import { numberedAddressesOf } from "./numbered-addresses.ts";

describe("numberedAddressesOf", () => {
  it("accepts a page that addresses everything by name", () => {
    expect(
      numberedAddressesOf({
        pages: [{ path: "README.md", text: "# Hone\n\nRead [Declared, not asserted](rules/rules.md#declared-not-asserted).\n" }],
        pinned: [],
      }),
    ).toEqual([]);
  });

  it("accepts a version 1 clause address written as inline code or inside a fenced block", () => {
    expect(
      numberedAddressesOf({
        pages: [
          {
            path: "ADOPTING.md",
            text: 'Select `authored-class-or-this#class-keyword` as `CD-14#class-syntax`.\n\n```json\n{ "CD-27#skipped-tests": "eslint" }\n```\n',
          },
        ],
        pinned: [],
      }),
    ).toEqual([]);
  });

  it("names each number in prose, in a link or in code without its clause, with its page and line", () => {
    expect(
      numberedAddressesOf({
        pages: [
          {
            path: "README.md",
            text: "# Hone\n\nCD-14 bans classes.\nSee [the rule](rules/CD-2/README.md) and `CD-27`.\n\n```\nCD-40\n```\n",
          },
        ],
        pinned: [],
      }),
    ).toEqual(["README.md:3 names CD-14", "README.md:4 names CD-2", "README.md:4 names CD-27", "README.md:7 names CD-40"]);
  });

  it("names a number in prose or in a link target whatever its case or separator", () => {
    expect(
      numberedAddressesOf({
        pages: [
          {
            path: "MIGRATING.md",
            text: "Moving cd-14 first.\nThen cd 4 and CD 40.\nCD27 last.\nSee [the rule](rules/cd-2/README.md).\n",
          },
        ],
        pinned: [],
      }),
    ).toEqual(["MIGRATING.md:1 names cd-14", "MIGRATING.md:2 names cd 4", "MIGRATING.md:2 names CD 40", "MIGRATING.md:3 names CD27", "MIGRATING.md:4 names cd-2"]);
  });

  it("accepts, inside code, a lower-case number in a file or namespace name, and names an upper-case one without its clause", () => {
    expect(
      numberedAddressesOf({
        pages: [
          {
            path: "docs/extending.md",
            text: "Load `cd14/cd14.eslint-plugin.ts` under `hone-cd14`.\n\n```\nhone-cd27/skipped-tests\nCD14\n```\n",
          },
        ],
        pinned: [],
      }),
    ).toEqual(["docs/extending.md:5 names CD14"]);
  });

  it("leaves a word that only ends in cd alone", () => {
    expect(numberedAddressesOf({ pages: [{ path: "README.md", text: "Run abcd 14 times, or abcd14.\n" }], pinned: [] })).toEqual([]);
  });

  it("names a number that follows a fenced block once the fence has closed", () => {
    expect(
      numberedAddressesOf({
        pages: [{ path: "MIGRATING.md", text: "```json\n{}\n```\nCD-5 moved.\n" }],
        pinned: [],
      }),
    ).toEqual(["MIGRATING.md:4 names CD-5"]);
  });

  it("accepts, inside code, the path of a pinned page as the tool prints it, and names one whose page is not pinned", () => {
    expect(
      numberedAddressesOf({
        pages: [
          { path: "rules/CD-17/README.md", text: "# Clock sources\n\nCD-17\n" },
          {
            path: "ADOPTING.md",
            text: "```\nCD-17#clock-sources: read node_modules/@hailstails/hone/rules/CD-17/README.md#spirit\nCD-15#loops: read ../rules/CD-15/README.md#spirit\n```\nSee rules/CD-17/README.md.\n",
          },
        ],
        pinned: ["rules/CD-17/README.md"],
      }),
    ).toEqual(["ADOPTING.md:3 names CD-15", "ADOPTING.md:5 names CD-17"]);
  });

  it("accepts any number on a pinned page", () => {
    expect(
      numberedAddressesOf({
        pages: [{ path: "rules/numbers.md", text: "# Every CD\n\n| [CD-1](CD-1/README.md) | Symptom |\n" }],
        pinned: ["rules/numbers.md"],
      }),
    ).toEqual([]);
  });

  it("reads only pages, leaving a shipped file of another kind alone", () => {
    expect(
      numberedAddressesOf({
        pages: [{ path: "rules/CD-14/discipline.json", text: '{ "id": "CD-14" }' }],
        pinned: [],
      }),
    ).toEqual([]);
  });

  it("names a pinned page that no longer gives a number, and one that is not shipped, so the list only shrinks", () => {
    expect(
      numberedAddressesOf({
        pages: [{ path: "rules/CD-14/README.md", text: "# Zero class authoring\n" }],
        pinned: ["rules/CD-14/README.md", "rules/CD-99/README.md"],
      }),
    ).toEqual([
      "rules/CD-14/README.md is pinned but gives no number; take it off the list",
      "rules/CD-99/README.md is pinned but not shipped; take it off the list",
    ]);
  });
});
