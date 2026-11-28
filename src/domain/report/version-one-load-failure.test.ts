import { describe, expect, it } from "vitest";

import type { Engine } from "../language-layer/symptom-catalogue.ts";
import type { RunLoadFailure } from "./run-load-failure.ts";
import {
  mapVersionOneSourceToFailure,
  type VersionOneFailureSource,
} from "./version-one-load-failure.ts";

type VersionOneRow = {
  readonly name: string;
  readonly source: VersionOneFailureSource;
  readonly failure: RunLoadFailure;
};

const AUDIT = "walker" as const;

const ESLINT = "eslint" as const;

const WALKER: Engine = { name: "walker" };

const ESLINT_ENGINE: Engine = { name: "eslint" };

const ENGINES: readonly Engine[] = [WALKER, ESLINT_ENGINE];

describe("mapVersionOneSourceToFailure, a failure the version 1 settings path names in version 2's words", () => {
  it.each<VersionOneRow>([
    {
      name: "the absent settings file",
      source: { kind: "selection-absent", repo: "/work/shop" },
      failure: { kind: "config-absent", repo: "/work/shop" },
    },
    {
      name: "an unknown discipline",
      source: { kind: "unknown-discipline", address: "CD-99#loops" },
      failure: { kind: "unknown-check", check: "CD-99#loops" },
    },
    {
      name: "an unknown clause",
      source: { kind: "unknown-clause", address: "CD-15#whiles" },
      failure: { kind: "unknown-check", check: "CD-15#whiles" },
    },
    {
      name: "a judgement clause selected",
      source: { kind: "judgement-clause-selected", address: "CD-3#names" },
      failure: { kind: "review-only-listed", check: "CD-3#names" },
    },
    {
      name: "a judgement clause listed",
      source: { kind: "judgement-clause-listed", address: "CD-3#names" },
      failure: { kind: "review-only-listed", check: "CD-3#names" },
    },
    {
      name: "a duplicate clause",
      source: {
        kind: "duplicate-clause",
        address: "CD-15#loops",
        prefixedAddress: "hone/CD-15#loops",
      },
      failure: {
        kind: "duplicate-check",
        key: "checks",
        check: "CD-15#loops",
        prefixedCheck: "hone/CD-15#loops",
      },
    },
    {
      name: "a mechanism the rule set does not allow",
      source: { kind: "mechanism-not-allowed", address: "CD-15#loops", mechanism: AUDIT },
      failure: {
        kind: "engine-not-allowed",
        check: "CD-15#loops",
        engine: "walker",
        allowed: { stated: "by-rule-set" },
      },
    },
    {
      name: "a missing runner",
      source: { kind: "runner-missing", mechanism: ESLINT },
      failure: { kind: "engine-missing", engine: { named: "engine", engine: ESLINT_ENGINE } },
    },
    {
      name: "an invalid runner",
      source: { kind: "runner-invalid", mechanism: AUDIT, detail: "no runner export" },
      failure: {
        kind: "engine-invalid",
        engine: { named: "engine", engine: WALKER },
        detail: "no runner export",
      },
    },
    {
      name: "a failed runner",
      source: {
        kind: "runner-failed",
        mechanism: ESLINT,
        failure: { kind: "tool-failed", detail: "ESLint exited 2" },
      },
      failure: {
        kind: "engine-failed",
        engine: { named: "engine", engine: ESLINT_ENGINE },
        failure: { kind: "tool-failed", detail: "ESLint exited 2" },
      },
    },
    {
      name: "a missing piece",
      source: { kind: "piece-missing", address: "CD-15#loops", mechanism: AUDIT },
      failure: {
        kind: "check-missing",
        check: "CD-15#loops",
        engine: { named: "engine", engine: WALKER },
      },
    },
  ])("names $name", ({ source, failure }) => {
    expect(mapVersionOneSourceToFailure({ source, engines: ENGINES })).toEqual(failure);
  });

  it("names a missing runner the catalogue names no engine for", () => {
    expect(
      mapVersionOneSourceToFailure({
        source: { kind: "runner-missing", mechanism: ESLINT },
        engines: [WALKER],
      }),
    ).toEqual({
      kind: "engine-missing",
      engine: { named: "mechanism", mechanism: ESLINT },
    });
  });
});
