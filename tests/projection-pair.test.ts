import { describe, expect, it, vi } from "vitest";
import type { ClauseBinding } from "../src/domain/settings/selection/selection.ts";
import { createPathPort } from "../src/infrastructure/node/path-port.ts";
import { clauseAddressSchema } from "../src/infrastructure/discipline-exceptions-folder/clause-address.ts";
import { FIRST_EDITION } from "../src/infrastructure/content-files/edition.ts";
import { mechanismIdSchema } from "../src/infrastructure/hone-config-file/identifiers.ts";
import { CHECKS_PLUGIN_CATALOGUE } from "./checks-plugin-catalogue.ts";
import { inCheckRuleIds, type SpecifierOf, versionOnePiecesOf } from "./projection-pair.ts";

const ESLINT = mechanismIdSchema.parse("eslint");

const bindingOf = (request: { readonly address: string; readonly pieceRoot: string; readonly settings: unknown }): ClauseBinding => ({
  mechanism: ESLINT,
  clause: {
    address: clauseAddressSchema.parse(request.address),
    anchor: { kind: "file" },
    pieceRoot: request.pieceRoot,
    settings: request.settings,
    clauseSettings: {},
    edition: FIRST_EDITION,
  },
});

const SKIPPED_TESTS = bindingOf({
  address: "CD-27#skipped-tests",
  pieceRoot: "/install/mechanisms/eslint/CD-27",
  settings: { pluginNamespace: "hone-cd27", pluginModule: "cd27/cd27.eslint-plugin.ts", rule: "skipped-tests" },
});

const PARAMETER_COUNT = bindingOf({
  address: "CD-40#parameter-count",
  pieceRoot: "/install/mechanisms/eslint/CD-40",
  settings: { pluginNamespace: "hone-cd40", pluginModule: "cd40/cd40.eslint-plugin.ts", rule: "max-params", options: [{ max: 2 }] },
});

const NON_NULL_ASSERTIONS = bindingOf({
  address: "CD-2#non-null-assertions",
  pieceRoot: "/install/mechanisms/eslint/CD-2",
  settings: { pluginNamespace: "hone-cd2", pluginModule: "cd2/cd2.eslint-plugin.ts", rule: "no-restricted-syntax" },
});

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("versionOnePiecesOf", () => {
  it("gathers ESLint bindings into one piece per plugin namespace, in the order each namespace is first bound", () => {
    const specifierOf = vi.fn<SpecifierOf>().mockReturnValue("file:///piece.ts");
    expect(versionOnePiecesOf({ bindings: [SKIPPED_TESTS, PARAMETER_COUNT], path: PATH, specifierOf })).toEqual([
      {
        pluginNamespace: "hone-cd27",
        pluginImport: "file:///piece.ts",
        clauses: [{ address: clauseAddressSchema.parse("CD-27#skipped-tests"), ruleId: "hone-cd27/skipped-tests", options: [] }],
      },
      {
        pluginNamespace: "hone-cd40",
        pluginImport: "file:///piece.ts",
        clauses: [{ address: clauseAddressSchema.parse("CD-40#parameter-count"), ruleId: "hone-cd40/max-params", options: [{ max: 2 }] }],
      },
    ]);
  });

  it("asks for the import of each namespace's plugin module", () => {
    const specifierOf = vi.fn<SpecifierOf>().mockReturnValue("file:///piece.ts");
    versionOnePiecesOf({ bindings: [SKIPPED_TESTS], path: PATH, specifierOf });
    expect(specifierOf).toHaveBeenCalledWith({ modulePath: "/install/mechanisms/eslint/CD-27/cd27/cd27.eslint-plugin.ts" });
  });
});

describe("inCheckRuleIds", () => {
  it("renames each version 1 rule id to its check's rule id, and keeps an id no binding names", () => {
    expect(
      inCheckRuleIds({
        catalogue: CHECKS_PLUGIN_CATALOGUE,
        bindings: [SKIPPED_TESTS, NON_NULL_ASSERTIONS],
        rules: { "hone-cd27/skipped-tests": [2], "hone-cd2/no-restricted-syntax": [0], "other/rule": [1] },
      }),
    ).toEqual({ "hone/test-switched-off#skipped-tests": [2], "hone/claimed-type#non-null-assertions": [0], "other/rule": [1] });
  });
});
