import { describe, expect, it } from "vitest";
import type { Selection } from "../../domain/settings/selection/selection.ts";
import { clauseAddressSchema } from "./clause-address.ts";
import { mechanismIdSchema } from "../hone-config-file/identifiers.ts";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { type PlacedEntry, UNMEASURED_EXCEPTION_BASELINE } from "./exception-records.ts";
import type { Result } from "../../domain/result.ts";
import { type HeadRecord, type HeadRecordsRefusal, headRecordsOf } from "./head-records.ts";
import type { VersionOneWhyChain } from "./version-one-why-chain.ts";

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because: "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because: "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because: "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because: "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because: "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause: "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck: "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const RECORDS_FILE = repoPathSchema.parse("discipline-exceptions.json");

const AUDIT = mechanismIdSchema.parse("audit");

const LOOPS = clauseAddressSchema.parse("CD-15#loops");

const SELECTION: Selection = {
  selected: [{ address: LOOPS, mechanism: AUDIT, exceptions: "allowed" }],
  uncovered: [],
  notAdopted: [],
  notRun: [],
  editions: [],
};

const AT_0 = { layout: "single-file", file: RECORDS_FILE, index: 0 } as const;

const AT_1 = { layout: "single-file", file: RECORDS_FILE, index: 1 } as const;

const AUTHORISED: PlacedEntry = {
  place: AT_0,
  entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
};

const CARVE_OUT: PlacedEntry = {
  place: AT_1,
  entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop" },
};

const AT_2 = { layout: "single-file", file: RECORDS_FILE, index: 2 } as const;

const headRecords = (request: { readonly entries: readonly PlacedEntry[] }): Result<readonly HeadRecord[], HeadRecordsRefusal> =>
  headRecordsOf({ entries: request.entries, selection: SELECTION, fileExceptionWhyChains: "optional", baseline: UNMEASURED_EXCEPTION_BASELINE });

describe("headRecordsOf", () => {
  it("pairs an authorised location with the entry as the file holds it", () => {
    expect(headRecords({ entries: [AUTHORISED] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "authorised-location",
          record: { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: "src/a.ts", reason: "kept" },
          entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
        },
      ],
    });
  });

  it("pairs a file carve-out with the entry as the file holds it, leaving its answer to the oracle", () => {
    expect(headRecords({ entries: [CARVE_OUT] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: "src/b.ts", reason: "legacy loop" },
          entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop" },
        },
      ],
    });
  });

  it("keeps the records in the order the file lists them", () => {
    expect(headRecords({ entries: [CARVE_OUT, AUTHORISED] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: "src/b.ts", reason: "legacy loop" },
          entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop" },
        },
        {
          kind: "authorised-location",
          record: { kind: "authorised-location", clause: LOOPS, mechanism: AUDIT, file: "src/a.ts", reason: "kept" },
          entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/a.ts", reason: "kept" },
        },
      ],
    });
  });

  it("pairs a file carve-out that carries a provenance with the whole entry, provenance included", () => {
    const provenance = { kind: "inherited-debt", source: "the old repository", decision: "keep until rewritten" } as const;
    expect(
      headRecords({ entries: [{ place: AT_1, entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop", provenance } }] }),
    ).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "file-carve-out",
          record: { kind: "file-carve-out", clause: LOOPS, mechanism: AUDIT, file: "src/b.ts", reason: "legacy loop", provenance },
          entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: "legacy loop", provenance },
        },
      ],
    });
  });

  it("pairs a clause-wide carve-out with no entry, since version 2 holds none of it", () => {
    expect(headRecords({ entries: [{ place: AT_0, entry: { kind: "clause-wide-carve-out", clause: "CD-15#loops", reason: "generated", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN } }] })).toEqual({
      outcome: "ok",
      value: [
        {
          kind: "clause-wide-carve-out",
          record: { kind: "clause-wide-carve-out", clause: LOOPS, mechanism: AUDIT, reason: "generated", whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN },
        },
      ],
    });
  });

  it("refuses every invalid record of the file, naming where each sits", () => {
    expect(
      headRecords({
        entries: [
          AUTHORISED,
          { place: AT_1, entry: { ...AUTHORISED.entry, reason: "kept again" } },
          { place: AT_2, entry: { ...AUTHORISED.entry, clause: "CD-16#unselected" } },
        ],
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "invalid-records",
        invalid: [
          { place: AT_1, problem: { kind: "duplicate", of: AT_0 } },
          { place: AT_2, problem: { kind: "clause-not-selected", clause: clauseAddressSchema.parse("CD-16#unselected") } },
        ],
      },
    });
  });

  it("refuses an entry whose clause the selection does not run", () => {
    expect(headRecords({ entries: [{ place: AT_0, entry: { ...AUTHORISED.entry, clause: "CD-16#unselected" } }] })).toEqual({
      outcome: "failed",
      error: {
        kind: "invalid-records",
        invalid: [{ place: AT_0, problem: { kind: "clause-not-selected", clause: clauseAddressSchema.parse("CD-16#unselected") } }],
      },
    });
  });

  it("refuses an entry that is not a JSON value rather than dropping its record, however many valid entries follow", () => {
    expect(
      headRecords({
        entries: [{ place: AT_0, entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/b.ts", reason: undefined } }, AUTHORISED],
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "entry-not-json", place: AT_0 },
    });
  });
});
