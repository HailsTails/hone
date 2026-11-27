import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { mapDisabledChecks } from "./inline.ts";

describe("mapDisabledChecks", () => {
  it("recognizes the ESLint spelling of a native Oxlint rule in a scanned directive", () => {
    const text = "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- justification";
    const file = repoPathOf("index.ts");
    const observed = mapDisabledChecks({
      text,
      file,
      line: 1,
      rules: [
        {
          rule: { kind: "native", id: "typescript/no-explicit-any", options: [] },
          binding: {
            ruleSet: TOOL_RULE_SET,
            engine: "oxlint",
            checkOptions: { kind: "none" },
            address: "untyped-value#explicit-any",
            pieceRoot: "/install/explicit-any",
            anchor: { kind: "keyword", keyword: "any" },
            settings: { rule: "typescript/no-explicit-any" },
            checkSettings: {},
            edition: editionOf("1"),
          },
        },
      ],
    });

    expect(observed).toEqual([
      {
        kind: "inline-disable",
        file,
        line: 1,
        text,
        check: "untyped-value#explicit-any",
        reach: "one-check",
      },
    ]);
  });
});
