import { describe, expect, it } from "vitest";
import { clauseAddressSchema } from "../../../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import { checksPageOf } from "./checks-page.ts";

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
    { symptom: "claimed-type", name: "cast-to-any", clause: clauseAddressSchema.parse("CD-1#any-cast") },
    { symptom: "claimed-type", name: "non-null-assertions", clause: clauseAddressSchema.parse("CD-1#non-null") },
  ],
  namedBans: [],
};

describe("checksPageOf", () => {
  it("renders each check under its symptom with its prose, leaving out a symptom with no checks", () => {
    expect(
      checksPageOf({
        file: FILE,
        prose: new Map([["typescript/symptoms/claimed-type/cast-to-any.md", "- **Misses:** casts in [tests](../../../rules/tests-stub-ports.md)."]]),
      }),
    ).toEqual({
      path: "rules/typescript/checks.md",
      text: "# Checks in TypeScript\n\n## Claimed type\n\n### cast-to-any\n\n- **Misses:** casts in [tests](../rules/tests-stub-ports.md).\n\n### non-null-assertions\n",
    });
  });
});
