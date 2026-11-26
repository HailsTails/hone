import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import {
  checksProjectionText,
  mapChecksProjectionOutputsToTypedFile,
  type ProjectedCheck,
} from "./checks-projection.ts";

const PACKAGE_IMPORT = "@hailstails/hone/eslint-plugin";

const TEAM = { name: ruleSetNameOf("team") };

const SKIPPED_TESTS: ProjectedCheck = {
  ruleSet: "hone",
  symptom: "test-switched-off",
  check: "skipped-tests",
  ruleId: "hone/test-switched-off#skipped-tests",
  options: [],
};

const FOCUSED_TESTS: ProjectedCheck = {
  ruleSet: "hone",
  symptom: "test-switched-off",
  check: "focused-tests",
  ruleId: "hone/test-switched-off#focused-tests",
  options: [],
};

const PARAMETER_COUNT: ProjectedCheck = {
  ruleSet: "hone",
  symptom: "positional-parameters",
  check: "parameter-count",
  ruleId: "hone/positional-parameters#parameter-count",
  options: [{ max: 2, countVoidThis: true }],
};

const NON_NULL_ASSERTIONS: ProjectedCheck = {
  ruleSet: "hone",
  symptom: "claimed-type",
  check: "non-null-assertions",
  ruleId: "hone/claimed-type#non-null-assertions",
  options: [],
};

describe("mapChecksProjectionOutputsToTypedFile", () => {
  it("gives the declaration as the typed file of the mjs kind", () => {
    const typedFile = mapChecksProjectionOutputsToTypedFile({
      outputs: {
        kind: "mjs",
        configuration: repoPathOf("hone.eslint.mjs"),
        declaration: repoPathOf("hone.eslint.d.mts"),
      },
    });

    expect(typedFile).toBe("hone.eslint.d.mts");
  });

  it("gives the configuration as the typed file of the ts kind", () => {
    const typedFile = mapChecksProjectionOutputsToTypedFile({
      outputs: { kind: "ts", configuration: repoPathOf("hone.eslint.ts") },
    });

    expect(typedFile).toBe("hone.eslint.ts");
  });
});

describe("checksProjectionText", () => {
  it("imports a team's plugin and switches off its named check only on the team's answered files", () => {
    const projection = checksProjectionText({
      kind: "mjs",
      pluginImport: PACKAGE_IMPORT,
      plugins: [{ namespace: "team", specifier: "./tools/plugin.ts" }],
      checks: [SKIPPED_TESTS, { ...SKIPPED_TESTS, ruleSet: TEAM, ruleId: "team/no-skips" }],
      answered: [
        {
          ruleSet: TEAM,
          symptom: "test-switched-off",
          check: "skipped-tests",
          file: repoPathOf("src/a.ts"),
        },
        {
          ruleSet: "hone",
          symptom: "test-switched-off",
          check: "skipped-tests",
          file: repoPathOf("src/b.ts"),
        },
      ],
    });
    expect(projection).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nimport plugin0 from "./tools/plugin.ts";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone, "team": plugin0 }, rules: { "hone/test-switched-off#skipped-tests": "error", "team/no-skips": "error" } },\n{ name: "hone/answered/team/test-switched-off#skipped-tests", files: ["src/a.ts"], rules: { "team/no-skips": "off" } },\n{ name: "hone/answered/test-switched-off#skipped-tests", files: ["src/b.ts"], rules: { "hone/test-switched-off#skipped-tests": "off" } }];\n',
    );
  });

  it("writes the plan's projection byte for byte", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS],
        answered: [],
      }),
    ).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/test-switched-off#skipped-tests": "error" } }];\n',
    );
  });

  it("enables every check's rule in code-unit order, with its options", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: "./api/eslint-plugin.ts",
        checks: [SKIPPED_TESTS, PARAMETER_COUNT, FOCUSED_TESTS],
        answered: [],
      }),
    ).toBe(
      'import hone from "./api/eslint-plugin.ts";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/positional-parameters#parameter-count": ["error",{"max":2,"countVoidThis":true}], "hone/test-switched-off#focused-tests": "error", "hone/test-switched-off#skipped-tests": "error" } }];\n',
    );
  });

  it("switches off, on each answered file, every rule of the symptoms its records answer, one block per set of symptoms", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS, FOCUSED_TESTS, NON_NULL_ASSERTIONS],
        answered: [
          { ruleSet: "hone", symptom: "test-switched-off", file: repoPathOf("src/b.test.ts") },
          { ruleSet: "hone", symptom: "claimed-type", file: repoPathOf("src/c.ts") },
          { ruleSet: "hone", symptom: "test-switched-off", file: repoPathOf("src/c.ts") },
          { ruleSet: "hone", symptom: "test-switched-off", file: repoPathOf("src/a.test.ts") },
        ],
      }),
    ).toBe(
      `import hone from "@hailstails/hone/eslint-plugin";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/claimed-type#non-null-assertions": "error", "hone/test-switched-off#focused-tests": "error", "hone/test-switched-off#skipped-tests": "error" } },
{ name: "hone/answered/claimed-type, test-switched-off", files: ["src/c.ts"], rules: { "hone/claimed-type#non-null-assertions": "off", "hone/test-switched-off#focused-tests": "off", "hone/test-switched-off#skipped-tests": "off" } },
{ name: "hone/answered/test-switched-off", files: ["src/a.test.ts", "src/b.test.ts"], rules: { "hone/test-switched-off#focused-tests": "off", "hone/test-switched-off#skipped-tests": "off" } }];
`,
    );
  });

  it("switches off, on a file whose record names one check of its symptom, only that check's rule", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS, FOCUSED_TESTS],
        answered: [
          {
            ruleSet: "hone",
            symptom: "test-switched-off",
            check: "skipped-tests",
            file: repoPathOf("src/a.test.ts"),
          },
          { ruleSet: "hone", symptom: "test-switched-off", file: repoPathOf("src/b.test.ts") },
        ],
      }),
    ).toBe(
      `import hone from "@hailstails/hone/eslint-plugin";
export default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/test-switched-off#focused-tests": "error", "hone/test-switched-off#skipped-tests": "error" } },
{ name: "hone/answered/test-switched-off", files: ["src/b.test.ts"], rules: { "hone/test-switched-off#focused-tests": "off", "hone/test-switched-off#skipped-tests": "off" } },
{ name: "hone/answered/test-switched-off#skipped-tests", files: ["src/a.test.ts"], rules: { "hone/test-switched-off#skipped-tests": "off" } }];
`,
    );
  });

  it("writes no block for a record whose check does not run on ESLint", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS],
        answered: [
          {
            ruleSet: "hone",
            symptom: "test-switched-off",
            check: "test-body",
            file: repoPathOf("src/a.test.ts"),
          },
        ],
      }),
    ).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/test-switched-off#skipped-tests": "error" } }];\n',
    );
  });

  it("escapes glob characters in an answered file's path", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [NON_NULL_ASSERTIONS],
        answered: [
          { ruleSet: "hone", symptom: "claimed-type", file: repoPathOf("app/[id]/page.ts") },
        ],
      }),
    ).toContain(
      '{ name: "hone/answered/claimed-type", files: ["app/\\\\[id\\\\]/page.ts"], rules: { "hone/claimed-type#non-null-assertions": "off" } }];',
    );
  });

  it("writes no block for a record whose symptom has no check on ESLint", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [SKIPPED_TESTS],
        answered: [{ ruleSet: "hone", symptom: "loop-keyword", file: repoPathOf("src/a.ts") }],
      }),
    ).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: { "hone/test-switched-off#skipped-tests": "error" } }];\n',
    );
  });

  it("writes the ts kind as a typed list that leaves its own file out, with a team's plugin and an answered file", () => {
    const projection = checksProjectionText({
      kind: "ts",
      pluginImport: PACKAGE_IMPORT,
      plugins: [{ namespace: "team", specifier: "./tools/plugin.ts" }],
      checks: [SKIPPED_TESTS],
      answered: [
        {
          ruleSet: "hone",
          symptom: "test-switched-off",
          check: "skipped-tests",
          file: repoPathOf("src/b.ts"),
        },
      ],
    });

    expect(projection).toBe(
      `import hone from "@hailstails/hone/eslint-plugin";
import plugin0 from "./tools/plugin.ts";
const projection: {
  name: string;
  files: string[];
  ignores?: string[];
  plugins?: Record<string, object>;
  rules: Record<string, "error" | "off" | ["error", ...unknown[]]>;
}[] = [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.ts"], plugins: { hone, "team": plugin0 }, rules: { "hone/test-switched-off#skipped-tests": "error" } },
{ name: "hone/answered/test-switched-off#skipped-tests", files: ["src/b.ts"], rules: { "hone/test-switched-off#skipped-tests": "off" } }];
export default projection;
`,
    );
  });

  it("writes an empty rule set when no check runs on ESLint", () => {
    expect(
      checksProjectionText({
        kind: "mjs",
        pluginImport: PACKAGE_IMPORT,
        checks: [],
        answered: [],
      }),
    ).toBe(
      'import hone from "@hailstails/hone/eslint-plugin";\nexport default [{ name: "hone/checks", files: ["**/*.{ts,tsx,mts,cts}"], ignores: ["hone.eslint.d.mts"], plugins: { hone }, rules: {} }];\n',
    );
  });
});
