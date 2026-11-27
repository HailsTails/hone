import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import { createOxlintProjection } from "./oxlint-projection.ts";

describe("createOxlintProjection", () => {
  it("limits selected rules to TypeScript and projects answers relative to the package", () => {
    const answered = repoPathOf("packages/app/src/debt.ts");
    const projection = createOxlintProjection({
      path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
      root: "/repo",
      installRoot: "/install",
      scope: {
        folder: "packages/app",
        config: repoPathOf("packages/app/.oxlintrc.json"),
        file: repoPathOf("packages/app/hone.oxlint.json"),
        files: [answered],
      },
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
      answers: [
        { ruleSet: TOOL_RULE_SET, symptom: "untyped-value", check: "explicit-any", file: answered },
        { ruleSet: TOOL_RULE_SET, symptom: "untyped-value", file: repoPathOf("root.ts") },
      ],
    });

    expect(projection.config).toEqual({
      jsPlugins: [],
      overrides: [
        { files: ["**/*.{ts,tsx,mts,cts}"], rules: { "typescript/no-explicit-any": ["error"] } },
        { files: ["./src/debt.ts"], rules: { "typescript/no-explicit-any": "off" } },
      ],
    });
  });
});
