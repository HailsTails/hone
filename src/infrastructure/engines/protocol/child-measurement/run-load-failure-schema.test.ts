import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../domain/rule-set/clause-address.ts";
import { runLoadFailureSchema } from "./run-load-failure-schema.ts";

describe("runLoadFailureSchema", () => {
  it("reads a load failure back with its kind", () => {
    const parsed = runLoadFailureSchema.safeParse({ kind: "config-absent", repo: "/repo" });

    expect(parsed).toEqual({ success: true, data: { kind: "config-absent", repo: "/repo" } });
  });

  it("reads an engine's failure back with the runner failure it carries", () => {
    const parsed = runLoadFailureSchema.safeParse({
      kind: "engine-failed",
      engine: { named: "engine", engine: { name: "eslint" } },
      failure: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        kind: "engine-failed",
        engine: { named: "engine", engine: { name: "eslint" } },
        failure: { kind: "team-config-unloadable", detail: "eslint.config.mjs threw" },
      },
    });
  });

  it("reads refused records back with each refusal's file and issues", () => {
    const parsed = runLoadFailureSchema.safeParse({
      kind: "records-refused",
      refusals: [
        {
          kind: "document-refused",
          file: "hone-records/debt/claimed-type.json",
          issues: [{ path: ["records", 0, "file"], message: "Required" }],
        },
      ],
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        kind: "records-refused",
        refusals: [
          {
            kind: "document-refused",
            file: repoPathOf("hone-records/debt/claimed-type.json"),
            issues: [{ path: ["records", 0, "file"], message: "Required" }],
          },
        ],
      },
    });
  });

  it("reads a settings rename listed under both names back", () => {
    const parsed = runLoadFailureSchema.safeParse({
      kind: "listed-under-both-names",
      path: "hone.config.json",
      under: "checks",
      from: "claimed-type#non-null-assertions",
      to: "claimed-type#non-null",
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        kind: "listed-under-both-names",
        path: "hone.config.json",
        under: "checks",
        from: "claimed-type#non-null-assertions",
        to: "claimed-type#non-null",
      },
    });
  });

  it("reads a renamed address outside the settings listings back", () => {
    const parsed = runLoadFailureSchema.safeParse({
      kind: "renamed-address-outside-listings",
      path: "hone.config.json",
      listings: ["checks", "checkSettings"],
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        kind: "renamed-address-outside-listings",
        path: "hone.config.json",
        listings: ["checks", "checkSettings"],
      },
    });
  });

  it("reads a symptom no catalogue holds back with its address", () => {
    const parsed = runLoadFailureSchema.safeParse({
      kind: "symptom-unheld",
      symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        kind: "symptom-unheld",
        symptom: { ruleSet: TOOL_RULE_SET, name: "claimed-type" },
      },
    });
  });

  it("refuses a kind no run load failure has", () => {
    const parsed = runLoadFailureSchema.safeParse({ kind: "engine-exploded" });

    expect(parsed).toMatchObject({ success: false });
  });
});
