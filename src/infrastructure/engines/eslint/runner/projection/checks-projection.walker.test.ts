import { assert, describe, expect, it } from "vitest";

import {
  checkAddressOfNames,
  checkAddressTextOf,
  checkNamesOf,
} from "../../../../../domain/language-layer/check-address-text.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import { defaultClauseSettings } from "../../../../../domain/settings/clause-settings/default-clause-settings.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { readBoundCatalogue } from "../../../../content-files/symptom-catalogues/bound-catalogue.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { readNamedPiece } from "../../../named-piece.ts";
import { namedChecksRunnerModuleSchema } from "../../../protocol/checks/checks-runner-module-schema.ts";
import { namedCheckConformance } from "../../../protocol/conformance.ts";
import { namedChecksRunner } from "../../../walker/runner/runner.ts";
import { PROJECTION_TYPE_TEXT } from "../toolchain/eslint-major-boundary.ts";
import { checksProjectionText } from "./checks-projection.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const catalogue = readBoundCatalogue({
  ruleSet: "hone",
  inheritedRecordKinds: [],
  installRoot: INSTALL_ROOT,
  ruleSetRoot: INSTALL_ROOT,
  fileText,
  path,
  directory: createDefaultDirectoryPort({}),
});
assert(catalogue.outcome === "ok" && catalogue.value.held === "catalogue");

const WALKER_BINDINGS: readonly CheckBinding[] = catalogue.value.catalogue.checks
  .filter(({ engines }) => engines.some(({ name }) => name === "walker"))
  .map((check): CheckBinding => {
    const address = checkAddressTextOf({ check });
    const names = checkNamesOf({ text: address });
    assert.isDefined(names);
    const piece = readNamedPiece({
      installRoot: INSTALL_ROOT,
      ruleSetRoot: INSTALL_ROOT,
      ...names,
      mechanism: "walker",
      fileText,
      path,
    });
    assert(piece.outcome === "ok");
    const { editions, anchor, pieceRoot, settings, declarations, forms } = piece.value;
    return {
      address,
      ruleSet: "hone",
      engine: "walker",
      edition: editions.latest,
      anchor,
      pieceRoot,
      settings,
      checkSettings: defaultClauseSettings({ declarations }),
      forms: Object.fromEntries(
        Object.entries(forms).map(([form, named]) => [form, checkAddressOfNames(named)]),
      ),
    };
  });

const walkerRunner = namedChecksRunnerModuleSchema.parse(namedChecksRunner);

describe("the ts kind projection Hone writes, judged by every check the walker runs", () => {
  it.each(WALKER_BINDINGS.map((binding) => ({ name: binding.address, binding })))(
    "holds no $name finding",
    async ({ binding }) => {
      const source = checksProjectionText({
        form: { kind: "ts", projectionTypeText: PROJECTION_TYPE_TEXT },
        pluginImport: "@hailstails/hone/eslint-plugin",
        plugins: [{ namespace: "team", specifier: "./tools/team.eslint-plugin.ts" }],
        checks: [
          {
            ruleSet: "hone",
            symptom: "test-switched-off",
            check: "skipped-tests",
            ruleId: "hone/test-switched-off#skipped-tests",
            options: ["conditional-and-todo"],
          },
          {
            ruleSet: { name: ruleSetNameOf("team") },
            symptom: "no-skips",
            check: "skip-calls",
            ruleId: "team/no-skips",
            options: [],
          },
        ],
        answered: [
          {
            ruleSet: "hone",
            symptom: "test-switched-off",
            check: "skipped-tests",
            file: repoPathOf("src/legacy.test.ts"),
          },
        ],
      });

      const conformance = await namedCheckConformance({
        binding,
        cases: [
          {
            name: "the ts kind projection",
            fileName: repoPathOf("hone.eslint.ts"),
            source,
            expectedLines: [],
          },
        ],
        runner: walkerRunner,
      });

      expect(conformance).toEqual({ outcome: "ok", value: [] });
    },
  );
});
