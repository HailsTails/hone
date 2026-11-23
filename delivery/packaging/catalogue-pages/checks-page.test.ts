import { describe, expect, it } from "vitest";

import { TOOL_RULE_SET } from "../../../src/domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../src/domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../src/domain/rule-set/discipline-id-of.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { addressedCheckOf, checksPageOf } from "./checks-page.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install/rules" });

const FILE: CatalogueFile = {
  version: 1,
  principles: [],
  rules: [],
  cases: [],
  recipes: [],
  recordKinds: [],
  engines: [],
  symptoms: [
    {
      name: "claimed-type",
      title: "Claimed type",
      group: "Claimed types",
      seen: "An `as T` cast.",
      mayIndicate: [{ case: "does-one-job", points: [{ principle: "one-place-decides" }] }],
      breachUsuallySits: "in the declaration",
      seenBy: ["syntax"],
      recipes: [],
      correctUses: [],
    },
    {
      name: "absence-as-state",
      title: "Absence as state",
      group: "Loose types",
      seen: "A null.",
      mayIndicate: [{ case: "does-one-job", points: [{ principle: "one-place-decides" }] }],
      breachUsuallySits: "in the type",
      seenBy: ["person"],
      recipes: [],
      correctUses: [],
    },
  ],
  clauses: [],
  checks: [
    {
      symptom: "claimed-type",
      name: "cast-to-any",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-1"),
        clause: clauseIdOf("any-cast"),
      },
    },
    {
      symptom: "claimed-type",
      name: "non-null-assertions",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-1"),
        clause: clauseIdOf("non-null"),
      },
    },
  ],
  namedBans: [],
};

describe("checksPageOf", () => {
  it("renders each check under its symptom with its prose, leaving out a symptom with no checks", () => {
    expect(
      checksPageOf({
        bindings: new Map(),
        file: FILE,
        path: PATH,
        prose: new Map([
          [
            "typescript/symptoms/claimed-type/cast-to-any.md",
            "- **Misses:** casts in [tests](../../../rules/tests-stub-ports.md).",
          ],
        ]),
      }),
    ).toEqual({
      path: "rules/typescript/checks.md",
      text: "# Checks in TypeScript\n\n## Claimed type\n\n### cast-to-any\n\n- **Misses:** casts in [tests](../rules/tests-stub-ports.md).\n\n### non-null-assertions\n",
    });
  });

  it("lists a check's margin facts above its prose, in the order flags beyond the symptom, misses, settings traced to", () => {
    const file: CatalogueFile = {
      ...FILE,
      checks: [
        {
          symptom: "claimed-type",
          name: "cast-to-any",
          clause: {
            ruleSet: TOOL_RULE_SET,
            discipline: disciplineIdOf("CD-1"),
            clause: clauseIdOf("any-cast"),
          },
          settingsTracedTo: "none.",
          misses: "casts in strings.",
          flagsBeyondTheSymptom: "`as const`.",
        },
      ],
    };
    expect(
      checksPageOf({
        bindings: new Map(),
        file,
        path: PATH,
        prose: new Map([
          ["typescript/symptoms/claimed-type/cast-to-any.md", "## Fix\n\nDeclare it."],
        ]),
      }),
    ).toEqual({
      path: "rules/typescript/checks.md",
      text: "# Checks in TypeScript\n\n## Claimed type\n\n### cast-to-any\n\n- **Flags beyond the symptom:** `as const`.\n- **Misses:** casts in strings.\n- **Settings traced to:** none.\n\n## Fix\n\nDeclare it.\n",
    });
  });

  it("lists the engines bound to each check, leaving out the line for a check no engine runs", () => {
    expect(
      checksPageOf({
        bindings: new Map([["claimed-type#cast-to-any", [{ name: "walker" }, { name: "eslint" }]]]),
        file: FILE,
        path: PATH,
        prose: new Map(),
      }),
    ).toEqual({
      path: "rules/typescript/checks.md",
      text: "# Checks in TypeScript\n\n## Claimed type\n\n### cast-to-any\n\n- **Engines:** `walker`, `eslint`\n\n### non-null-assertions\n",
    });
  });
});

describe("addressedCheckOf", () => {
  it("addresses a check by its name and its symptom's name", () => {
    expect(addressedCheckOf({ symptom: "claimed-type", name: "cast-to-any" })).toEqual({
      name: "cast-to-any",
      symptom: { name: "claimed-type" },
    });
  });
});
