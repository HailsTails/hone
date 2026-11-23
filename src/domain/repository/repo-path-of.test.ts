import { describe, expect, it } from "vitest";

import { ruleSetNameOf } from "../rule-set/rule-set-name-of.ts";
import { repoPathBeneath, repoPathOf } from "./repo-path-of.ts";
import { isRepoPath } from "./repo-path.ts";

describe("repoPathOf", () => {
  it.each(["a.ts", "src/a.ts", "src/[id].ts", "hone-records/debt", "a..b.ts"] as const)(
    "returns %s unchanged",
    (text) => {
      expect(repoPathOf(text)).toBe(text);
    },
  );

  it("returns text the repo-path guard accepts", () => {
    expect(isRepoPath(repoPathOf("src/a.ts"))).toBe(true);
  });
});

describe("repoPathBeneath", () => {
  it("joins a record kind under a parent", () => {
    expect(repoPathBeneath({ parent: repoPathOf("hone-records"), segment: "debt" })).toBe(
      "hone-records/debt",
    );
  });

  it("joins a rule-set name under a parent", () => {
    expect(
      repoPathBeneath({ parent: repoPathOf("hone-records"), segment: ruleSetNameOf("acme") }),
    ).toBe("hone-records/acme");
  });
});
