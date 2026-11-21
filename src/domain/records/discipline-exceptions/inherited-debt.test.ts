import { describe, expect, it } from "vitest";
import type { AttributedNativeException, Finding } from "../../finding/governance.ts";
import { clauseAddressSchema } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import { mechanismIdSchema } from "../../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { type InheritedDebtOutcome, inheritedDebtEntriesOf, inheritedDebtOf, type InheritedDebtRequest, reachedDebtOf } from "./inherited-debt.ts";

const LOOPS = clauseAddressSchema.parse("CD-15#loops");
const CASTS = clauseAddressSchema.parse("CD-2#cast-expressions");
const TEAM_CLAUSE = clauseAddressSchema.parse("team/TM-1#no-tmp-files");
const AUDIT = mechanismIdSchema.parse("audit");
const ESLINT = mechanismIdSchema.parse("eslint");
const LEGACY_FOLDER = repoPathSchema.parse("src/legacy");
const SOURCE_FOLDER = repoPathSchema.parse("src");
const BASKET = repoPathSchema.parse("src/basket.ts");
const LEGACY = repoPathSchema.parse("src/legacy/report.ts");
const FRESH = repoPathSchema.parse("src/fresh.ts");
const SINGLE_FILE = repoPathSchema.parse("discipline-exceptions.json");
const LOCATIONS_FILE = repoPathSchema.parse("discipline-exceptions/authorised-locations/cd-15.json");
const CARVE_OUTS_FILE = repoPathSchema.parse("discipline-exceptions/file-carve-outs/cd-15.json");

const findingAt = (request: { readonly clause: Finding["clause"]; readonly file: Finding["file"]; readonly line: number }): Finding => ({
  clause: request.clause,
  mechanism: AUDIT,
  file: request.file,
  anchor: { line: request.line, column: 0 },
  snippet: "const total = 0;",
});

const directiveAt = (request: { readonly file: Finding["file"]; readonly line: number }): AttributedNativeException => ({
  kind: "inline-disable",
  clause: CASTS,
  mechanism: AUDIT,
  file: request.file,
  line: request.line,
  text: "// @ts-expect-error",
  reach: "one-clause",
});

const NOTHING: InheritedDebtRequest = {
  findings: [],
  unrecorded: [],
  existing: [],
  leave: [],
  inBase: new Set([BASKET, LEGACY]),
  refusing: [],
};

describe("inheritedDebtOf choosing pairs", () => {
  it("names each clause and file once, however many findings it holds, ordered by file and then clause", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [
          findingAt({ clause: LOOPS, file: LEGACY, line: 3 }),
          findingAt({ clause: LOOPS, file: BASKET, line: 9 }),
          findingAt({ clause: LOOPS, file: BASKET, line: 4 }),
          findingAt({ clause: CASTS, file: BASKET, line: 2 }),
        ],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET, effect: "recorded" },
      { clause: CASTS, file: BASKET, effect: "recorded" },
      { clause: LOOPS, file: LEGACY, effect: "recorded" },
    ]);
  });

  it("records an unrecorded inline disable or directive as debt on its clause and file, beside a finding there", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: CASTS, file: BASKET, line: 2 })],
        unrecorded: [directiveAt({ file: BASKET, line: 7 }), directiveAt({ file: LEGACY, line: 1 })],
      }),
    ).toEqual([
      { clause: CASTS, file: BASKET, effect: "recorded" },
      { clause: CASTS, file: LEGACY, effect: "recorded" },
    ]);
  });

  it("leaves every other unrecorded native exception to the person, since a file record cannot hold it the same way", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        unrecorded: [
          { kind: "config-override", clause: LOOPS, mechanism: AUDIT, file: BASKET },
          {
            kind: "command-line-option",
            clause: LOOPS,
            mechanism: AUDIT,
            location: repoPathSchema.parse("package.json"),
            script: "lint",
            option: "--rule",
            cause: { kind: "weakens-run" },
          },
        ],
      }),
    ).toEqual([]);
  });

});

describe("inheritedDebtOf writing nothing for a pair", () => {
  it("does not record a pair that already has a record on that clause and file, whatever its kind or how its clause is spelled, naming the file that holds it", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: BASKET, line: 4 }), findingAt({ clause: LOOPS, file: LEGACY, line: 4 })],
        existing: [
          {
            place: { layout: "single-file", file: SINGLE_FILE, index: 0 },
            entry: { kind: "file-carve-out", clause: "hone/CD-15#loops", file: "src/basket.ts", reason: "forfeited since the base" },
          },
          {
            place: { layout: "split", file: LOCATIONS_FILE, index: 0 },
            entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/legacy/report.ts", reason: "an invalid one" },
          },
        ],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET, effect: "already-recorded", heldIn: "discipline-exceptions.json" },
      { clause: LOOPS, file: LEGACY, effect: "already-recorded", heldIn: "discipline-exceptions/authorised-locations/cd-15.json" },
    ]);
  });

  it("names the first file holding a pair recorded twice", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: BASKET, line: 4 })],
        existing: [
          {
            place: { layout: "split", file: LOCATIONS_FILE, index: 0 },
            entry: { kind: "authorised-location", clause: "CD-15#loops", file: "src/basket.ts", reason: "held" },
          },
          {
            place: { layout: "split", file: CARVE_OUTS_FILE, index: 0 },
            entry: { kind: "file-carve-out", clause: "CD-15#loops", file: "src/basket.ts", reason: "held twice" },
          },
        ],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET, effect: "already-recorded", heldIn: "discipline-exceptions/authorised-locations/cd-15.json" }]);
  });

  it("is not stopped by a clause-wide carve-out or by an entry whose clause cannot be read", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: BASKET, line: 4 })],
        existing: [
          {
            place: { layout: "single-file", file: SINGLE_FILE, index: 0 },
            entry: { kind: "clause-wide-carve-out", clause: "CD-15#loops", reason: "refused for its chain", whyChain: {} },
          },
          {
            place: { layout: "single-file", file: SINGLE_FILE, index: 1 },
            entry: { kind: "file-carve-out", clause: "not an address", file: "src/basket.ts", reason: "unreadable" },
          },
        ],
      }),
    ).toEqual([{ clause: LOOPS, file: BASKET, effect: "recorded" }]);
  });

});

describe("inheritedDebtOf leaving a pair for a person", () => {
  it("leaves a file under a --leave path, naming the path, for a person to record as an authorised location", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: LEGACY, line: 3 }), findingAt({ clause: LOOPS, file: BASKET, line: 3 })],
        leave: [repoPathSchema.parse("src/legacy"), repoPathSchema.parse("src/basket.ts")],
      }),
    ).toEqual([
      { clause: LOOPS, file: BASKET, effect: "left", under: repoPathSchema.parse("src/basket.ts") },
      { clause: LOOPS, file: LEGACY, effect: "left", under: repoPathSchema.parse("src/legacy") },
    ]);
  });

  it("does not take a --leave folder for a prefix of a longer name", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: LOOPS, file: LEGACY, line: 3 })],
        leave: [repoPathSchema.parse("src/leg")],
      }),
    ).toEqual([{ clause: LOOPS, file: LEGACY, effect: "recorded" }]);
  });

  it("does not record a file the base revision does not hold, since nothing in it was inherited", () => {
    expect(
      inheritedDebtOf({ ...NOTHING, findings: [findingAt({ clause: LOOPS, file: FRESH, line: 1 })] }),
    ).toEqual([{ clause: LOOPS, file: FRESH, effect: "new-file" }]);
  });

  it("does not record a clause whose discipline refuses exceptions", () => {
    expect(
      inheritedDebtOf({
        ...NOTHING,
        findings: [findingAt({ clause: TEAM_CLAUSE, file: BASKET, line: 1 })],
        refusing: [TEAM_CLAUSE],
      }),
    ).toEqual([{ clause: TEAM_CLAUSE, file: BASKET, effect: "refused" }]);
  });
});

describe("inheritedDebtEntriesOf", () => {
  it("writes one file carve-out naming only its clause and file for each recorded pair, with the clause as the report prints it", () => {
    expect(
      inheritedDebtEntriesOf({
        outcomes: [
          { clause: TEAM_CLAUSE, file: BASKET, effect: "recorded" },
          { clause: LOOPS, file: LEGACY, effect: "left", under: LEGACY },
          { clause: LOOPS, file: FRESH, effect: "new-file" },
        ],
      }),
    ).toEqual([{ kind: "file-carve-out", clause: "team/TM-1#no-tmp-files", file: "src/basket.ts" }]);
  });
});

const RECORDED_IN_LEGACY: readonly InheritedDebtOutcome[] = [
  { clause: CASTS, file: LEGACY, effect: "recorded" },
  { clause: LOOPS, file: LEGACY, effect: "recorded" },
  { clause: LOOPS, file: BASKET, effect: "recorded" },
  { clause: TEAM_CLAUSE, file: LEGACY, effect: "left", under: LEGACY_FOLDER },
];

describe("reachedDebtOf", () => {
  it("turns a recorded pair into nested-configuration only where its clause's mechanism cannot project into the folder holding the file", () => {
    expect(
      reachedDebtOf({
        outcomes: RECORDED_IN_LEGACY,
        unprojected: [{ mechanism: ESLINT, folder: LEGACY_FOLDER, selectionFolder: SOURCE_FOLDER }],
        mechanisms: new Map([
          ["CD-2#cast-expressions", AUDIT],
          ["CD-15#loops", ESLINT],
          ["team/TM-1#no-tmp-files", ESLINT],
        ]),
      }),
    ).toEqual([
      { clause: CASTS, file: LEGACY, effect: "recorded" },
      { clause: LOOPS, file: LEGACY, effect: "nested-configuration", under: LEGACY_FOLDER, selectionFolder: SOURCE_FOLDER, mechanism: ESLINT },
      { clause: LOOPS, file: BASKET, effect: "recorded" },
      { clause: TEAM_CLAUSE, file: LEGACY, effect: "left", under: LEGACY_FOLDER },
    ]);
  });

  it("keeps every outcome when each mechanism projects into every folder", () => {
    expect(reachedDebtOf({ outcomes: RECORDED_IN_LEGACY, unprojected: [], mechanisms: new Map([["CD-15#loops", ESLINT]]) })).toEqual(RECORDED_IN_LEGACY);
  });
});
