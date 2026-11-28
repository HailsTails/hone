import { assert, describe, expect, it } from "vitest";

import type { CheckAddressText } from "../../../../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../../../../domain/repository/absolute-path-types.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { Result } from "../../../../../domain/result.ts";
import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { RunnerFailure } from "../../../../../domain/runner/runner-failure.ts";
import { createDefaultEntryKindPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import type { NamedChecksRunner } from "../../../protocol/checks/checks-runner-types.ts";
import { toolchainBoundNamedChecksRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import { createWalkerRunner } from "../../runner/create-walker-runner.ts";
import type { TypeScriptParsePort } from "../../runner/toolchain/typescript-parse.ts";
import {
  defaultTypeScriptPeers,
  loadParsePort,
  typeScriptPeersNamed,
} from "../../runner/toolchain/typescript-toolchain.ts";

const path = createDefaultPathPort({});

const DEVELOPMENT_ROOT = `${import.meta.dirname}/../../../../../..`;
const install = path.resolve({ path: DEVELOPMENT_ROOT });
const repository = path.resolve({ path: `${import.meta.dirname}/cd3-extends` });

const createFixtureRunner = (
  toolchain: Promise<Result<TypeScriptParsePort, RunnerFailure>>,
): NamedChecksRunner =>
  toolchainBoundNamedChecksRunner({
    fileScope: "tracked",
    projectedKinds: [],
    toolchain,
    runnerOf: (parse) =>
      createWalkerRunner({
        fileText: createDefaultFileTextPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        parse,
        entryKind: createDefaultEntryKindPort({}),
      }),
  });

const INHERITS = repoPathOf("packages/inherits/tsconfig.json");
const LOOSENED = repoPathOf("packages/loosened/tsconfig.json");
const UNSET = repoPathOf("packages/unset/tsconfig.json");
const BROKEN = repoPathOf("packages/broken/tsconfig.json");
const LAYERED = repoPathOf("packages/layered/tsconfig.json");
const SOLUTION = repoPathOf("tsconfig.json");

const STRICT: CheckAddressText = "strictness-weakened#strict";
const UNCHECKED: CheckAddressText = "strictness-weakened#no-unchecked-indexed-access";
const EXACT: CheckAddressText = "strictness-weakened#exact-optional-property-types";
const OVERRIDE: CheckAddressText = "strictness-weakened#no-implicit-override";
const FALLTHROUGH: CheckAddressText = "strictness-weakened#no-fallthrough-cases-in-switch";
const PROPERTY: CheckAddressText = "strictness-weakened#no-property-access-from-index-signature";
const CATCH: CheckAddressText = "strictness-weakened#use-unknown-in-catch-variables";

const createCheckBinding = (request: {
  readonly address: CheckAddressText;
  readonly installRoot: AbsolutePath;
}): CheckBinding => ({
  address: request.address,
  ruleSet: "hone",
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: `${request.installRoot}/src/infrastructure/engines/walker/strictness-weakened/strict`,
  checkSettings: {},
  edition: editionOf("2"),
  settings: { module: "compiler-overrides.ts" },
});

const createCheckBindings = (installRoot: AbsolutePath): readonly CheckBinding[] => [
  createCheckBinding({ address: STRICT, installRoot }),
  createCheckBinding({ address: UNCHECKED, installRoot }),
  createCheckBinding({ address: EXACT, installRoot }),
  createCheckBinding({ address: OVERRIDE, installRoot }),
  createCheckBinding({ address: FALLTHROUGH, installRoot }),
  createCheckBinding({ address: PROPERTY, installRoot }),
  createCheckBinding({ address: CATCH, installRoot }),
];

const AT_FILE = { line: 1, column: 0 } as const;

const MISSING_BASE = "unknown: TS5083 Cannot read file 'configs/missing.json'.";

const SHARED_HITS = [
  {
    check: UNCHECKED,
    file: LOOSENED,
    anchor: AT_FILE,
    snippet: "compilerOptions.noUncheckedIndexedAccess = false, inherited from configs/loose.json",
  },
  {
    check: UNCHECKED,
    file: UNSET,
    anchor: AT_FILE,
    snippet: "compilerOptions.noUncheckedIndexedAccess unset here and in configs/partial.json",
  },
  {
    check: EXACT,
    file: UNSET,
    anchor: AT_FILE,
    snippet: "compilerOptions.exactOptionalPropertyTypes unset here and in configs/partial.json",
  },
  {
    check: OVERRIDE,
    file: UNSET,
    anchor: AT_FILE,
    snippet: "compilerOptions.noImplicitOverride unset here and in configs/partial.json",
  },
  {
    check: FALLTHROUGH,
    file: UNSET,
    anchor: AT_FILE,
    snippet: "compilerOptions.noFallthroughCasesInSwitch unset here and in configs/partial.json",
  },
  {
    check: PROPERTY,
    file: UNSET,
    anchor: AT_FILE,
    snippet:
      "compilerOptions.noPropertyAccessFromIndexSignature unset here and in configs/partial.json",
  },
  {
    check: STRICT,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.strict ${MISSING_BASE}`,
  },
  {
    check: UNCHECKED,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.noUncheckedIndexedAccess ${MISSING_BASE}`,
  },
  {
    check: EXACT,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.exactOptionalPropertyTypes ${MISSING_BASE}`,
  },
  {
    check: OVERRIDE,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.noImplicitOverride ${MISSING_BASE}`,
  },
  {
    check: FALLTHROUGH,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.noFallthroughCasesInSwitch ${MISSING_BASE}`,
  },
  {
    check: PROPERTY,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.noPropertyAccessFromIndexSignature ${MISSING_BASE}`,
  },
  {
    check: CATCH,
    file: BROKEN,
    anchor: AT_FILE,
    snippet: `compilerOptions.useUnknownInCatchVariables ${MISSING_BASE}`,
  },
] as const;

const EVERY_CLAUSE_ON_EVERY_TSCONFIG = [
  { check: STRICT, file: INHERITS },
  { check: UNCHECKED, file: INHERITS },
  { check: EXACT, file: INHERITS },
  { check: OVERRIDE, file: INHERITS },
  { check: FALLTHROUGH, file: INHERITS },
  { check: PROPERTY, file: INHERITS },
  { check: CATCH, file: INHERITS },
  { check: STRICT, file: LOOSENED },
  { check: UNCHECKED, file: LOOSENED },
  { check: EXACT, file: LOOSENED },
  { check: OVERRIDE, file: LOOSENED },
  { check: FALLTHROUGH, file: LOOSENED },
  { check: PROPERTY, file: LOOSENED },
  { check: CATCH, file: LOOSENED },
  { check: STRICT, file: UNSET },
  { check: UNCHECKED, file: UNSET },
  { check: EXACT, file: UNSET },
  { check: OVERRIDE, file: UNSET },
  { check: FALLTHROUGH, file: UNSET },
  { check: PROPERTY, file: UNSET },
  { check: CATCH, file: UNSET },
  { check: STRICT, file: BROKEN },
  { check: UNCHECKED, file: BROKEN },
  { check: EXACT, file: BROKEN },
  { check: OVERRIDE, file: BROKEN },
  { check: FALLTHROUGH, file: BROKEN },
  { check: PROPERTY, file: BROKEN },
  { check: CATCH, file: BROKEN },
  { check: STRICT, file: LAYERED },
  { check: UNCHECKED, file: LAYERED },
  { check: EXACT, file: LAYERED },
  { check: OVERRIDE, file: LAYERED },
  { check: FALLTHROUGH, file: LAYERED },
  { check: PROPERTY, file: LAYERED },
  { check: CATCH, file: LAYERED },
  { check: STRICT, file: SOLUTION },
  { check: UNCHECKED, file: SOLUTION },
  { check: EXACT, file: SOLUTION },
  { check: OVERRIDE, file: SOLUTION },
  { check: FALLTHROUGH, file: SOLUTION },
  { check: PROPERTY, file: SOLUTION },
  { check: CATCH, file: SOLUTION },
] as const;

const SINGLE_BASE_ONLY =
  "unknown: TS5024 Compiler option 'extends' requires a value of type string.";

describe("CD-3 edition 2 over a real extends chain on disk, through the shipped audit runner (CD-47: the fixture repository is the assertion's subject; nothing is spawned or written)", () => {
  it.each([
    {
      line: "typescript",
      version: /^6\./,
      peers: defaultTypeScriptPeers({ installRoot: DEVELOPMENT_ROOT, installForm: "source" }),
      layeredHits: [
        {
          check: OVERRIDE,
          file: LAYERED,
          anchor: AT_FILE,
          snippet:
            "compilerOptions.noImplicitOverride = false, inherited from configs/override-off.json",
        },
      ],
    },
    {
      line: "typescript-floor",
      version: /^4\.8\.4$/,
      peers: typeScriptPeersNamed({
        installRoot: DEVELOPMENT_ROOT,
        installForm: "source",
        packageName: "typescript-floor",
      }),
      layeredHits: [
        {
          check: STRICT,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.strict ${SINGLE_BASE_ONLY}`,
        },
        {
          check: UNCHECKED,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.noUncheckedIndexedAccess ${SINGLE_BASE_ONLY}`,
        },
        {
          check: EXACT,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.exactOptionalPropertyTypes ${SINGLE_BASE_ONLY}`,
        },
        {
          check: OVERRIDE,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.noImplicitOverride ${SINGLE_BASE_ONLY}`,
        },
        {
          check: FALLTHROUGH,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.noFallthroughCasesInSwitch ${SINGLE_BASE_ONLY}`,
        },
        {
          check: PROPERTY,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.noPropertyAccessFromIndexSignature ${SINGLE_BASE_ONLY}`,
        },
        {
          check: CATCH,
          file: LAYERED,
          anchor: AT_FILE,
          snippet: `compilerOptions.useUnknownInCatchVariables ${SINGLE_BASE_ONLY}`,
        },
      ],
    },
  ] as const)(
    "judges each tsconfig.json by the options it resolves to on the $line line",
    async ({ line, version, peers, layeredHits }) => {
      const parsing = loadParsePort({ peers });
      const loaded = await parsing;
      assert(loaded.outcome === "ok", `the ${line} line loads from the development install`);
      assert(
        version.test(loaded.value.syntaxApi.version),
        `the ${line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
      );
      assert(install.outcome === "ok", "the development root resolves");
      assert(repository.outcome === "ok", "the fixture root resolves");

      const installRoot = install.value;
      const report = await createFixtureRunner(parsing).run({
        repoRoot: repository.value,
        installRoot,
        files: [INHERITS, LOOSENED, UNSET, BROKEN, LAYERED, SOLUTION],
        trackedPaths: [INHERITS, LOOSENED, UNSET, BROKEN, LAYERED, SOLUTION],
        bindings: createCheckBindings(installRoot),
        answered: [],
        declaredConfigRoots: [],
        declaredConfigLookup: undefined,
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      });

      expect(report).toEqual({
        outcome: "ok",
        value: {
          hits: [...SHARED_HITS, ...layeredHits],
          nativeExceptions: [],
          measured: EVERY_CLAUSE_ON_EVERY_TSCONFIG,
          inapplicable: [],
          projection: "none",
          slices: [],
          nestedConfigurations: [],
          unprojectedFolders: [],
          misnamedRuleIds: [],
        },
      });
    },
  );
});
