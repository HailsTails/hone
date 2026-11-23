import { assert, describe, expect, it } from "vitest";

import {
  checkAddressOfNames,
  checkAddressTextOf,
  checkNamesOf,
  type CheckAddressText,
} from "../../../../domain/language-layer/check-address-text.ts";
import type { Result } from "../../../../domain/result.ts";
import type { SourceCase } from "../../../../domain/rule-set/rule-set-types.ts";
import type { CheckBinding } from "../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import { defaultClauseSettings } from "../../../../domain/settings/clause-settings/default-clause-settings.ts";
import { absolutePathSchema } from "../../../content-files/absolute-path.ts";
import { createNamedCheckExamplesRepository } from "../../../content-files/rule-sets/named-check-examples.ts";
import { readBoundCatalogue } from "../../../content-files/symptom-catalogues/bound-catalogue.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultDirectoryPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import { readNamedPiece } from "../../named-piece.ts";
import { namedChecksRunnerModuleSchema } from "../../protocol/checks/checks-runner-module-schema.ts";
import { namedCheckConformance } from "../../protocol/conformance.ts";
import { toolchainBoundNamedChecksRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { createWalkerRunner } from "./create-walker-runner.ts";
import { namedChecksRunner } from "./runner.ts";
import type { TypeScriptParsePort } from "./toolchain/typescript-parse.ts";
import { loadParsePort, typeScriptPeersNamed } from "./toolchain/typescript-toolchain.ts";

type ConformanceRow = {
  readonly name: string;
  readonly binding: CheckBinding;
  readonly cases: readonly SourceCase[];
};

const RULE_SET_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../..`);

const fileText = createDefaultFileTextPort({});
const path = createDefaultPathPort({});
const roots = { installRoot: RULE_SET_ROOT, ruleSetRoot: RULE_SET_ROOT };
const examples = createNamedCheckExamplesRepository({ fileText, path });

const rowsOf = (address: CheckAddressText): readonly ConformanceRow[] => {
  const names = checkNamesOf({ text: address });
  assert.isDefined(names);
  const piece = readNamedPiece({ ...roots, ...names, mechanism: "walker", fileText, path });
  assert(piece.outcome === "ok");
  const read = examples.read({ ...roots, check: address, engine: "walker" });
  assert(read.outcome === "ok");
  const { editions, anchor, pieceRoot, settings, declarations, forms } = piece.value;
  return editions.declared.flatMap((edition) => {
    const cases = read.value.examples.filter(
      (example) => (example.edition ?? editions.default) === edition,
    );
    const binding: CheckBinding = {
      address,
      ruleSet: "hone",
      engine: "walker",
      edition,
      anchor,
      pieceRoot,
      settings,
      checkSettings: defaultClauseSettings({ declarations }),
      forms: Object.fromEntries(
        Object.entries(forms).map(([form, named]) => [form, checkAddressOfNames(named)]),
      ),
    };
    return cases.length === 0 ? [] : [{ name: `${address} edition ${edition}`, binding, cases }];
  });
};

const FLOOR_PEERS = typeScriptPeersNamed({
  installRoot: `${import.meta.dirname}/../../../../..`,
  installForm: "source",
  packageName: "typescript-floor",
});

const floorParsePort = async (): Promise<TypeScriptParsePort> => {
  const loaded = await loadParsePort({ peers: FLOOR_PEERS });
  assert(loaded.outcome === "ok", "the typescript-floor line loads from the development install");
  assert(
    /^4\.8\.4$/.test(loaded.value.syntaxApi.version),
    `the typescript-floor line runs TypeScript ${loaded.value.syntaxApi.version}`,
  );
  return loaded.value;
};

declare global {
  interface ImportMeta {
    readonly glob: (
      patterns: readonly string[],
      options: {
        readonly base: string;
        readonly query: "?raw";
        readonly import: "default";
        readonly eager: true;
      },
    ) => Readonly<Record<string, string>>;
  }
}

const catalogue = readBoundCatalogue({
  ruleSet: "hone",
  ...roots,
  fileText,
  path,
  directory: createDefaultDirectoryPort({}),
});
assert(catalogue.outcome === "ok" && catalogue.value.held === "catalogue");
const CONFORMANCE_ROWS = catalogue.value.catalogue.checks
  .filter(({ engines }) => engines.some(({ name }) => name === "walker"))
  .flatMap((check) => rowsOf(checkAddressTextOf({ check })));
const walkerRunner = namedChecksRunnerModuleSchema.parse(namedChecksRunner);

describe("the shipped walker pieces", () => {
  it("includes example coverage from installed check declarations", () => {
    expect(CONFORMANCE_ROWS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "authored-class-or-this#class-keyword edition 1" }),
      ]),
    );
  });
});

describe("the shipped walker runner conforms to its named examples", () => {
  it.each(CONFORMANCE_ROWS)(
    "$name has no conformance failure over its flag and allow cases",
    async (row) => {
      expect(
        await namedCheckConformance({
          binding: row.binding,
          cases: row.cases,
          runner: walkerRunner,
        }),
      ).toEqual({
        outcome: "ok",
        value: [],
      });
    },
  );
});

describe("the shipped walker runner conforms to its named examples on TypeScript 4.8.4", () => {
  const floorRunner = namedChecksRunnerModuleSchema.parse(
    toolchainBoundNamedChecksRunner({
      fileScope: "tracked",
      projectedKinds: [],
      toolchain: floorParsePort().then((parse): Result<TypeScriptParsePort, RunnerFailure> => ({
        outcome: "ok",
        value: parse,
      })),
      runnerOf: (parse) =>
        createWalkerRunner({
          fileText: createDefaultFileTextPort({}),
          modules: createDefaultModuleLoaderPort({}),
          path: createDefaultPathPort({}),
          parse,
          entryKind: createDefaultEntryKindPort({}),
        }),
    }),
  );

  it.each(CONFORMANCE_ROWS)(
    "$name has no conformance failure over its flag and allow cases",
    async (row) => {
      expect(
        await namedCheckConformance({
          binding: row.binding,
          cases: row.cases,
          runner: floorRunner,
        }),
      ).toEqual({
        outcome: "ok",
        value: [],
      });
    },
  );
});
