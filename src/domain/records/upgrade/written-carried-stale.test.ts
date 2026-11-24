import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../repository/repo-path-of.ts";
import type { StaleRecord } from "../answering/answering.ts";
import type { PlacedRecord } from "../hone-records/hone-record.ts";
import { mapStaleRecordsToWrittenCarried } from "./written-carried-stale.ts";

describe("mapStaleRecordsToWrittenCarried", () => {
  it("keeps every stale carried location on one check and file, whatever party it is for", () => {
    const written = repoPathOf("hone-records/authorised-locations/third-party-import.json");
    const winston: PlacedRecord = {
      place: { file: written, index: 1 },
      record: {
        kind: "authorised-location",
        symptom: { ruleSet: "hone", name: "third-party-import" },
        reach: {
          reaches: "one-check",
          check: {
            symptom: { ruleSet: "hone", name: "third-party-import" },
            name: "import-boundaries",
          },
        },
        file: repoPathOf("src/ids.ts"),
        holding: {
          held: "carried",
          entry: {},
          lacks: ["case"],
          standing: "established",
          binding: {
            binds: "check-file-and-outside-party",
            outsideParty: { kind: "package", dependency: "winston" },
          },
        },
      },
    };
    const nodeScheme: PlacedRecord = {
      place: { file: written, index: 2 },
      record: {
        kind: "authorised-location",
        symptom: { ruleSet: "hone", name: "third-party-import" },
        reach: {
          reaches: "one-check",
          check: {
            symptom: { ruleSet: "hone", name: "third-party-import" },
            name: "import-boundaries",
          },
        },
        file: repoPathOf("src/ids.ts"),
        holding: {
          held: "carried",
          entry: {},
          lacks: ["case"],
          standing: "established",
          binding: {
            binds: "check-file-and-outside-party",
            outsideParty: { kind: "scheme", scheme: "node" },
          },
        },
      },
    };
    const stale: readonly StaleRecord[] = [
      { placed: winston, reason: "credited-nothing" },
      { placed: nodeScheme, reason: "credited-nothing" },
    ];

    const carried = mapStaleRecordsToWrittenCarried({ stale, written: [written] });

    expect(carried).toEqual([winston, nodeScheme]);
  });

  it("keeps carried debt whatever its stale reason, and leaves stated records and records in files the upgrade did not write", () => {
    const written = repoPathOf("hone-records/debt/loop-keyword.json");
    const carriedDebt: PlacedRecord = {
      place: { file: written, index: 0 },
      record: {
        kind: "debt",
        symptom: { ruleSet: "hone", name: "loop-keyword" },
        reach: { reaches: "whole-symptom" },
        file: repoPathOf("src/gone.ts"),
        holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
      },
    };
    const statedDebt: PlacedRecord = {
      place: { file: written, index: 1 },
      record: {
        kind: "debt",
        symptom: { ruleSet: "hone", name: "loop-keyword" },
        reach: { reaches: "whole-symptom" },
        file: repoPathOf("src/b.ts"),
        holding: { held: "stated" },
      },
    };
    const dependency: PlacedRecord = {
      place: { file: written, index: 2 },
      record: {
        kind: "dependency-record",
        dependency: "lodash",
        nativeWay: "Array methods",
        whyNotEnough: "it is",
      },
    };
    const carriedElsewhere: PlacedRecord = {
      place: { file: repoPathOf("hone-records/debt/rebinding.json"), index: 0 },
      record: {
        kind: "debt",
        symptom: { ruleSet: "hone", name: "rebinding" },
        reach: { reaches: "whole-symptom" },
        file: repoPathOf("src/a.ts"),
        holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
      },
    };
    const stale: readonly StaleRecord[] = [
      { placed: carriedDebt, reason: "file-gone" },
      { placed: statedDebt, reason: "file-excluded" },
      { placed: dependency, reason: "credited-nothing" },
      { placed: carriedElsewhere, reason: "credited-nothing" },
    ];

    const carried = mapStaleRecordsToWrittenCarried({ stale, written: [written] });

    expect(carried).toEqual([carriedDebt]);
  });
});
