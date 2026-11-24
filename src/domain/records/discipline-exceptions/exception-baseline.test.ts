import { describe, expect, it } from "vitest";

import { authorisationStandingOf, type ExceptionBaseline } from "./exception-baseline.ts";

const MEASURED: ExceptionBaseline = {
  measured: "yes",
  entriesAtBase: [],
  sourceTextsAtBase: new Map(),
  basePathOfRenamed: new Map(),
};

const UNMEASURED: ExceptionBaseline = { measured: "no", base: { state: "not-given" } };

const LEGACY_CHAIN = { whys: ["it was copied"], root: "the validator lowercases" };

describe("authorisationStandingOf", () => {
  it.each<{
    readonly name: string;
    readonly record: { readonly whyChain?: unknown; readonly provenance?: unknown };
    readonly baseline: ExceptionBaseline;
    readonly standing: "established" | "provisional";
  }>([
    {
      name: "a record with no evidence judges itself, so stands without a base",
      record: {},
      baseline: UNMEASURED,
      standing: "established",
    },
    {
      name: "a causal why chain judges itself, so stands without a base",
      record: { whyChain: { rootCheck: "git grep", readback: "it holds" } },
      baseline: UNMEASURED,
      standing: "established",
    },
    {
      name: "a legacy why chain is judged at the base, so is provisional when the base is unmeasured",
      record: { whyChain: LEGACY_CHAIN },
      baseline: UNMEASURED,
      standing: "provisional",
    },
    {
      name: "a legacy why chain is judged at the base, so stands when the base is measured",
      record: { whyChain: LEGACY_CHAIN },
      baseline: MEASURED,
      standing: "established",
    },
    {
      name: "provenance alone is judged at the base, so is provisional when the base is unmeasured",
      record: { provenance: { kind: "carve-out", source: "cd-14.json" } },
      baseline: UNMEASURED,
      standing: "provisional",
    },
  ])("$name", ({ record, baseline, standing }) => {
    expect(authorisationStandingOf({ record, baseline })).toBe(standing);
  });
});
