import { describe, expect, it } from "vitest";

import type { WhyChain } from "../../domain/records/why-chain.ts";
import {
  carriedAuthorisedLocationWireSchema,
  carriedFormSchema,
  debtWireSchema,
  recordsDocumentSchema,
  statedAuthorisedLocationWireSchema,
} from "./records-wire.ts";

const CAUSAL_WHY_CHAIN: WhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootEvidence:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

describe("the version 2 records forms", () => {
  it("reads a records document of version 2", () => {
    expect(
      recordsDocumentSchema.safeParse({ version: 2, records: [{ answers: "claimed-type" }] }),
    ).toMatchObject({
      success: true,
      data: { version: 2, records: [{ answers: "claimed-type" }] },
    });
  });

  it("refuses a records document with a key beside version and records", () => {
    expect(
      recordsDocumentSchema.safeParse({ version: 2, records: [], exceptions: [] }),
    ).toMatchObject({
      success: false,
      error: {
        issues: [expect.objectContaining({ code: "unrecognized_keys", keys: ["exceptions"] })],
      },
    });
  });

  it("refuses a record with a key its kind does not state, such as a kind key the folder already gives", () => {
    expect(
      debtWireSchema.safeParse({ kind: "debt", answers: "claimed-type", file: "src/a.ts" }),
    ).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ code: "unrecognized_keys", keys: ["kind"] })] },
    });
  });

  it("refuses a debt record that names its address symptom, pointing at answers", () => {
    expect(
      debtWireSchema.safeParse({ symptom: "claimed-type#cast-expressions", file: "src/a.ts" }),
    ).toMatchObject({
      success: false,
      error: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "unrecognized_keys",
            keys: ["symptom"],
            message: "`symptom` is `answers` in version 2",
          }),
        ]),
      },
    });
  });

  it("refuses a stated authorised location that names its address symptom, pointing at answers", () => {
    expect(
      statedAuthorisedLocationWireSchema.safeParse({
        symptom: "claimed-type#cast-expressions",
        file: "src/a.ts",
        case: "gives-a-value-its-type",
        owes: "declared-not-asserted",
        whyChain: CAUSAL_WHY_CHAIN,
      }),
    ).toMatchObject({
      success: false,
      error: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "unrecognized_keys",
            keys: ["symptom"],
            message: "`symptom` is `answers` in version 2",
          }),
        ]),
      },
    });
  });

  it("refuses a carried authorised location that names its address symptom, pointing at answers", () => {
    expect(
      carriedAuthorisedLocationWireSchema.safeParse({
        symptom: "claimed-type#cast-expressions",
        file: "src/a.ts",
        carried: { kind: "authorised-location" },
      }),
    ).toMatchObject({
      success: false,
      error: {
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "unrecognized_keys",
            keys: ["symptom"],
            message: "`symptom` is `answers` in version 2",
          }),
        ]),
      },
    });
  });

  it("refuses a site that is not a repository path", () => {
    expect(
      debtWireSchema.safeParse({ answers: "claimed-type", file: "../outside.ts" }),
    ).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ path: ["file"] })] },
    });
  });

  it("reads a symptom alone as a record reaching the whole symptom", () => {
    expect(debtWireSchema.safeParse({ answers: "claimed-type", file: "src/a.ts" })).toMatchObject({
      success: true,
      data: { answers: { reaches: "whole-symptom", symptom: "claimed-type" } },
    });
  });

  it("reads a symptom and one of its checks, written <symptom>#<check>, as a record reaching that check", () => {
    expect(
      statedAuthorisedLocationWireSchema.safeParse({
        answers: "claimed-type#cast-expressions",
        file: "src/a.ts",
        case: "gives-a-value-its-type",
        owes: "declared-not-asserted",
        whyChain: CAUSAL_WHY_CHAIN,
      }),
    ).toMatchObject({
      success: true,
      data: {
        answers: { reaches: "one-check", symptom: "claimed-type", check: "cast-expressions" },
      },
    });
  });

  it("refuses a stated authorised location whose whyChain gives rootCheck, the version 1 name, asking for rootEvidence", () => {
    expect(
      statedAuthorisedLocationWireSchema.safeParse({
        answers: "claimed-type",
        file: "src/a.ts",
        case: "gives-a-value-its-type",
        owes: "declared-not-asserted",
        whyChain: {
          whys: CAUSAL_WHY_CHAIN.whys,
          rootCause: CAUSAL_WHY_CHAIN.rootCause,
          rootCheck: CAUSAL_WHY_CHAIN.rootEvidence,
          readback: CAUSAL_WHY_CHAIN.readback,
          owner: CAUSAL_WHY_CHAIN.owner,
        },
      }),
    ).toMatchObject({
      success: false,
      error: {
        issues: [
          {
            path: ["whyChain", "rootEvidence"],
            message:
              "`whyChain.rootEvidence` is required beside `readback` in a causal chain: name what was run or read today that shows the root still holds, with a path, record, measurement or link",
          },
          {
            path: ["whyChain"],
            message: "`whyChain.rootCheck` is `whyChain.rootEvidence` in version 2",
          },
        ],
      },
    });
  });

  it.each([
    { answers: "claimed-type#" },
    { answers: "#cast-expressions" },
    { answers: "claimed-type#cast-expressions#again" },
    { answers: "claimed-type#Cast" },
  ])("refuses $answers as the address a record answers", ({ answers }) => {
    expect(
      carriedAuthorisedLocationWireSchema.safeParse({
        answers,
        file: "src/a.ts",
        carried: { kind: "authorised-location" },
      }),
    ).toMatchObject({
      success: false,
      error: { issues: [expect.objectContaining({ path: ["answers"] })] },
    });
  });

  it.each([
    { outsideParty: "c:/Users/x" },
    { outsideParty: String.raw`c:\Users` },
    { outsideParty: "C:/Users/x" },
    { outsideParty: "file:///etc/x.js" },
    { outsideParty: "file:./local.ts" },
    { outsideParty: "./local.ts" },
    { outsideParty: "../src/x.ts" },
    { outsideParty: "/etc/x.js" },
    { outsideParty: "pkg/../../src/x" },
    { outsideParty: "@scope/pkg/../x" },
    { outsideParty: "lodash/fp" },
    { outsideParty: "Not A Package" },
  ])(
    "refuses $outsideParty as an outside party, since it is no package's name, module or scheme",
    ({ outsideParty }) => {
      expect(
        statedAuthorisedLocationWireSchema.safeParse({
          answers: "outside-import-past-a-boundary#import-or-require",
          file: "src/adapters/files.ts",
          case: "adapter-per-outside-party",
          owes: "external-behaviour-sits-at-a-boundary",
          whyChain: CAUSAL_WHY_CHAIN,
          outsideParty,
        }),
      ).toMatchObject({
        success: false,
        error: { issues: [expect.objectContaining({ path: ["outsideParty"] })] },
      });
    },
  );

  it.each([
    { outsideParty: "zod" },
    { outsideParty: "@scope/pkg" },
    { outsideParty: "node:fs" },
    { outsideParty: "node:" },
    { outsideParty: "jsr:@std/path" },
  ])("accepts $outsideParty as an outside party", ({ outsideParty }) => {
    expect(
      statedAuthorisedLocationWireSchema.safeParse({
        answers: "outside-import-past-a-boundary#import-or-require",
        file: "src/adapters/files.ts",
        case: "adapter-per-outside-party",
        owes: "external-behaviour-sits-at-a-boundary",
        whyChain: CAUSAL_WHY_CHAIN,
        outsideParty,
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      entry: {
        answers: "claimed-type",
        file: "src/a.ts",
        carried: { kind: "authorised-location" },
      },
      form: true,
    },
    { entry: { answers: "claimed-type", file: "src/a.ts" }, form: false },
    { entry: "claimed-type", form: false },
  ])("tells a carried record by its carried key: $entry", ({ entry, form }) => {
    expect(carriedFormSchema.safeParse(entry).success).toBe(form);
  });
});

it("accepts a positive whole count on a debt row", () => {
  const entry = { answers: "claimed-type#cast-expressions", file: "src/cart.ts", findings: 2 };

  const parsed = debtWireSchema.safeParse(entry);

  expect(parsed).toMatchObject({ success: true, data: { findings: 2 } });
});

it.each([0, -1, 1.5, "2"])("refuses an invalid debt finding count %s", (findings) => {
  const entry = { answers: "claimed-type#cast-expressions", file: "src/cart.ts", findings };

  const parsed = debtWireSchema.safeParse(entry);

  expect(parsed.success).toBe(false);
});
