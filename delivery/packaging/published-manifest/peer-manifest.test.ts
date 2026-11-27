import { assert, describe, expect, it } from "vitest";

import developmentManifest from "../../../package.json" with { type: "json" };
import { OXLINT_RANGE } from "../../../src/infrastructure/engines/oxlint/runner/toolchain/oxlint-toolchain.ts";
import {
  ESLINT_REQUIREMENT,
  TYPESCRIPT_ESLINT_PARSER_REQUIREMENT,
  TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT,
} from "../../../src/infrastructure/engines/protocol/toolchain/eslint-peer-requirements.ts";
import { TYPESCRIPT_REQUIREMENT } from "../../../src/infrastructure/engines/walker/runner/toolchain/typescript-toolchain.ts";
import { createDefaultFileTextPort } from "../../../src/infrastructure/node/file-system/file-text-port.ts";
import { peerKindsOf } from "./published-manifest.ts";

const fileText = createDefaultFileTextPort({});

describe("the package manifest's peers", () => {
  it("declares the supported Oxlint version range", () => {
    expect(developmentManifest.peerDependencies.oxlint).toBe(OXLINT_RANGE);
  });
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
    const manifest = fileText.read({ path: `${import.meta.dirname}/../../../package.json` });
    assert(manifest.outcome === "ok");

    const peers = peerKindsOf({ developmentManifest: manifest.value });

    expect(peers).toEqual({
      outcome: "ok",
      value: {
        [TYPESCRIPT_REQUIREMENT.packageName]: TYPESCRIPT_REQUIREMENT.peer,
        [ESLINT_REQUIREMENT.packageName]: ESLINT_REQUIREMENT.peer,
        oxlint: "optional",
        [TYPESCRIPT_ESLINT_PARSER_REQUIREMENT.packageName]:
          TYPESCRIPT_ESLINT_PARSER_REQUIREMENT.peer,
        [TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.packageName]:
          TYPESCRIPT_ESLINT_PLUGIN_REQUIREMENT.peer,
      },
    });
  });
});
