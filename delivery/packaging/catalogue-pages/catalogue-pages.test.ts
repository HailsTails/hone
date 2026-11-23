import { describe, expect, it } from "vitest";

import type { EngineBindingsRepository } from "../../../src/application/ports/engine-bindings-repository.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { cataloguePagesOf } from "./catalogue-pages.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/install/rules" });

const NAMES = {
  path: "src/infrastructure/disciplines-file/version-one-names.json",
  text: '{ "version": 1, "clauses": [], "recordKinds": {} }',
};

const PRINCIPLE = {
  path: "rules/principles/one-place-decides.md",
  text: "# One place decides\n\n```json\n{}\n```\n\n- **Must hold:** One decision, one unit.\n",
};

const README = { path: "rules/README.md", text: "# Rules\n\nNo item.\n" };

const OUTSIDE_RULES = { path: "docs/principles/elsewhere.md", text: "Not an item." };

const NO_ENGINES: EngineBindingsRepository = { read: () => ({ outcome: "ok", value: new Map() }) };

const CASE = {
  path: "rules/cases/does-one-job.md",
  text: '# Does one job\n\n```json\n{ "standing": "accepted", "owes": [{ "principle": "one-place-decides" }] }\n```\n',
};

const SYMPTOM = {
  path: "rules/typescript/symptoms/ambient-randomness.md",
  text: '# Ambient randomness\n\n```json\n{ "group": "World", "seen": "A call.", "mayIndicate": [{ "case": "does-one-job", "points": [{ "principle": "one-place-decides" }] }], "breachUsuallySits": "in the unit", "seenBy": ["syntax"], "recipes": [], "correctUses": [] }\n```\n',
};

const CHECK = {
  path: "rules/typescript/symptoms/ambient-randomness/random-call.md",
  text: "# random-call\n\n```json\n{}\n```\n",
};

describe("cataloguePagesOf", () => {
  it("renders the six pages from the item files under rules and the version 1 names", () => {
    expect(
      cataloguePagesOf({
        path: PATH,
        engineBindings: NO_ENGINES,
        files: [NAMES, README, PRINCIPLE, OUTSIDE_RULES],
      }),
    ).toEqual({
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

  it("lists on the checks page the engines the bindings give each check read from the items", () => {
    expect(
      cataloguePagesOf({
        path: PATH,
        engineBindings: {
          read: () => ({
            outcome: "ok",
            value: new Map([["ambient-randomness#random-call", [{ name: "walker" }]]]),
          }),
        },
        files: [NAMES, PRINCIPLE, CASE, SYMPTOM, CHECK],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: [
        {},
        {},
        {},
        {},
        {},
        {
          path: "rules/typescript/checks.md",
          text: "# Checks in TypeScript\n\n## Ambient randomness\n\n### random-call\n\n- **Engines:** `walker`\n",
        },
      ],
    });
  });

  it("fails naming the piece when the engine bindings cannot be read", () => {
    expect(
      cataloguePagesOf({
        path: PATH,
        engineBindings: {
          read: () => ({
            outcome: "failed",
            error: {
              kind: "file-malformed",
              path: "/package/src/infrastructure/engines/walker/ambient-randomness/random-call/piece.json",
              detail: "ambient-randomness#random-call: no anchor",
            },
          }),
        },
        files: [NAMES, PRINCIPLE, CASE, SYMPTOM, CHECK],
      }),
    ).toMatchObject({
      outcome: "failed",
      error: expect.stringContaining(
        "/package/src/infrastructure/engines/walker/ambient-randomness/random-call/piece.json",
      ),
    });
  });

  it("fails when the version 1 names are not among the files", () => {
    expect(
      cataloguePagesOf({ path: PATH, engineBindings: NO_ENGINES, files: [PRINCIPLE] }),
    ).toEqual({
      outcome: "failed",
      error: "src/infrastructure/disciplines-file/version-one-names.json is not among the files",
    });
  });

  it("fails naming the file when an item has no facts", () => {
    expect(
      cataloguePagesOf({
        path: PATH,
        engineBindings: NO_ENGINES,
        files: [
          NAMES,
          {
            path: "rules/principles/one-place-decides.md",
            text: "# One place decides\n\nNo facts.\n",
          },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: "rules/principles/one-place-decides.md holds no fenced json block of facts",
    });
  });
});
