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
  type TypeScriptPeers,
  typeScriptPeersNamed,
} from "../../runner/toolchain/typescript-toolchain.ts";

const path = createDefaultPathPort({});

type TypeScriptLine = "typescript" | "typescript-floor";

const LINE_VERSIONS: Readonly<Record<TypeScriptLine, RegExp>> = {
  typescript: /^6\./,
  "typescript-floor": /^4\.8\.4$/,
};

const DEVELOPMENT_ROOT = `${import.meta.dirname}/../../../../../..`;

const PEERS_ON: Readonly<Record<TypeScriptLine, TypeScriptPeers>> = {
  typescript: defaultTypeScriptPeers({ installRoot: DEVELOPMENT_ROOT, installForm: "source" }),
  "typescript-floor": typeScriptPeersNamed({
    installRoot: DEVELOPMENT_ROOT,
    installForm: "source",
    packageName: "typescript-floor",
  }),
};

const parsePortOn = async (request: {
  readonly line: TypeScriptLine;
}): Promise<TypeScriptParsePort> => {
  const loaded = await loadParsePort({ peers: PEERS_ON[request.line] });
  assert(loaded.outcome === "ok", `the ${request.line} line loads from the development install`);
  assert(
    LINE_VERSIONS[request.line].test(loaded.value.syntaxApi.version),
    `the ${request.line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
  );
  return loaded.value;
};

const auditRunnerOn = (request: { readonly line: TypeScriptLine }): NamedChecksRunner =>
  toolchainBoundNamedChecksRunner({
    fileScope: "tracked",
    projectedKinds: [],
    toolchain: parsePortOn(request).then((parse): Result<TypeScriptParsePort, RunnerFailure> => ({
      outcome: "ok",
      value: parse,
    })),
    runnerOf: (parse) =>
      createWalkerRunner({
        fileText: createDefaultFileTextPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        parse,
        entryKind: createDefaultEntryKindPort({}),
      }),
  });

const resolvedPath = (request: { readonly path: string }): AbsolutePath => {
  const resolved = path.resolve(request);
  assert(resolved.outcome === "ok", `${request.path} resolves to an absolute path`);
  return resolved.value;
};

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../../../../../..` });

const REPO_ROOT = resolvedPath({ path: `${import.meta.dirname}/cd3-extends` });

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

const secondEditionClause = (request: { readonly address: CheckAddressText }): CheckBinding => ({
  address: request.address,
  engine: "walker",
  anchor: { kind: "file" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/walker/strictness-weakened/strict`,
  checkSettings: {},
  edition: editionOf("2"),
  settings: { module: "compiler-overrides.ts" },
});

const CLAUSES: readonly CheckBinding[] = [
  secondEditionClause({ address: STRICT }),
  secondEditionClause({ address: UNCHECKED }),
  secondEditionClause({ address: EXACT }),
  secondEditionClause({ address: OVERRIDE }),
  secondEditionClause({ address: FALLTHROUGH }),
  secondEditionClause({ address: PROPERTY }),
  secondEditionClause({ address: CATCH }),
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
    async ({ line, layeredHits }) => {
      const report = await auditRunnerOn({ line }).run({
        repoRoot: REPO_ROOT,
        installRoot: INSTALL_ROOT,
        files: [INHERITS, LOOSENED, UNSET, BROKEN, LAYERED, SOLUTION],
        trackedPaths: [INHERITS, LOOSENED, UNSET, BROKEN, LAYERED, SOLUTION],
        bindings: CLAUSES,
        answered: [],
        declaredConfigRoots: [],
        declaredConfigLookup: undefined,
      });

      expect(report).toEqual({
        outcome: "ok",
        value: {
          hits: [...SHARED_HITS, ...layeredHits],
          nativeExceptions: [],
          measured: EVERY_CLAUSE_ON_EVERY_TSCONFIG,
          projection: "none",
          slices: [],
          misnamedRuleIds: [],
        },
      });
    },
  );
});
