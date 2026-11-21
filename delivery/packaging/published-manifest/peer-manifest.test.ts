import { describe, expect, it } from "vitest";
import { TYPESCRIPT_REQUIREMENT } from "../../../src/infrastructure/engines/audit/runner/toolchain/typescript-toolchain.ts";
import {
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
} from "../../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import developmentManifest from "../../../package.json" with { type: "json" };
import { peerKindsOf } from "./published-manifest.ts";

describe("the package manifest's peers", () => {
  it("requires typescript, which every audit clause needs, and leaves the ESLint toolchain optional", () => {
    expect({
      typescript: TYPESCRIPT_REQUIREMENT.peer,
      eslint: ESLINT_REQUIREMENT.peer,
      "@typescript-eslint/parser": TYPESCRIPT_ESLINT_PARSER_REQUIREMENT.peer,
      "@typescript-eslint/eslint-plugin": TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.peer,
    }).toEqual({
      typescript: "required",
      eslint: "optional",
      "@typescript-eslint/parser": "optional",
      "@typescript-eslint/eslint-plugin": "optional",
    });
  });

  it("declares each toolchain package as the kind of peer the mechanism that loads it says it is", () => {
    expect(peerKindsOf({ developmentManifest: JSON.stringify(developmentManifest) })).toEqual({
      outcome: "ok",
      value: {
        [TYPESCRIPT_REQUIREMENT.packageName]: TYPESCRIPT_REQUIREMENT.peer,
        [ESLINT_REQUIREMENT.packageName]: ESLINT_REQUIREMENT.peer,
        [TYPESCRIPT_ESLINT_PARSER_REQUIREMENT.packageName]: TYPESCRIPT_ESLINT_PARSER_REQUIREMENT.peer,
        [TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.packageName]: TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.peer,
      },
    });
  });
});
