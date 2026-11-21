import { assert, describe, expect, it } from "vitest";
import type { RunnerFailure } from "../../../../domain/runner/runner-failure.ts";
import type { Result } from "../../../../domain/result.ts";
import type { RunnerClause, StandaloneRunner } from "../../protocol/runner-module/runner-module-schema.ts";
import { toolchainBoundStandaloneRunner } from "../../protocol/toolchain/toolchain-bound-runner.ts";
import { createDefaultEntryKindPort } from "../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../node/path-port.ts";
import type { AbsolutePath } from "../../../content-files/absolute-path.ts";
import { clauseAddressSchema } from "../../../discipline-exceptions-folder/clause-address.ts";
import { editionSchema } from "../../../content-files/edition.ts";
import { repoPathSchema } from "../../../hone-records-folder/repo-path.ts";
import { createWalkerRunner } from "../runner/create-walker-runner.ts";
import type { TypeScriptParsePort } from "../runner/toolchain/typescript-parse.ts";
import { defaultTypeScriptPeers, loadParsePort, type TypeScriptPeers, typeScriptPeersNamed } from "../runner/toolchain/typescript-toolchain.ts";

const path = createDefaultPathPort({});

type TypeScriptLine = "typescript" | "typescript-floor";

const LINE_VERSIONS: Readonly<Record<TypeScriptLine, RegExp>> = { typescript: /^6\./, "typescript-floor": /^4\.8\.4$/ };

const DEVELOPMENT_ROOT = `${import.meta.dirname}/../../../../..`;

const PEERS_ON: Readonly<Record<TypeScriptLine, TypeScriptPeers>> = {
  typescript: defaultTypeScriptPeers({ installRoot: DEVELOPMENT_ROOT, installForm: "source" }),
  "typescript-floor": typeScriptPeersNamed({ installRoot: DEVELOPMENT_ROOT, installForm: "source", packageName: "typescript-floor" }),
};

const parsePortOn = async (request: { readonly line: TypeScriptLine }): Promise<TypeScriptParsePort> => {
  const loaded = await loadParsePort({ peers: PEERS_ON[request.line] });
  assert(loaded.outcome === "ok", `the ${request.line} line loads from the development install`);
  assert(
    LINE_VERSIONS[request.line].test(loaded.value.syntaxApi.version),
    `the ${request.line} line runs TypeScript ${loaded.value.syntaxApi.version}`,
  );
  return loaded.value;
};

const auditRunnerOn = (request: { readonly line: TypeScriptLine }): StandaloneRunner =>
  toolchainBoundStandaloneRunner({
    toolchain: parsePortOn(request).then((parse): Result<TypeScriptParsePort, RunnerFailure> => ({ outcome: "ok", value: parse })),
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

const INSTALL_ROOT = resolvedPath({ path: `${import.meta.dirname}/../../../../..` });

const REPO_ROOT = resolvedPath({ path: `${import.meta.dirname}/cd3-extends` });

const INHERITS = repoPathSchema.parse("packages/inherits/tsconfig.json");
const LOOSENED = repoPathSchema.parse("packages/loosened/tsconfig.json");
const UNSET = repoPathSchema.parse("packages/unset/tsconfig.json");
const BROKEN = repoPathSchema.parse("packages/broken/tsconfig.json");
const LAYERED = repoPathSchema.parse("packages/layered/tsconfig.json");
const SOLUTION = repoPathSchema.parse("tsconfig.json");

const STRICT = clauseAddressSchema.parse("CD-3#strict");
const UNCHECKED = clauseAddressSchema.parse("CD-3#no-unchecked-indexed-access");
const EXACT = clauseAddressSchema.parse("CD-3#exact-optional-property-types");
const OVERRIDE = clauseAddressSchema.parse("CD-3#no-implicit-override");
const FALLTHROUGH = clauseAddressSchema.parse("CD-3#no-fallthrough-cases-in-switch");
const PROPERTY = clauseAddressSchema.parse("CD-3#no-property-access-from-index-signature");
const CATCH = clauseAddressSchema.parse("CD-3#use-unknown-in-catch-variables");

const secondEditionClause = (request: { readonly address: typeof STRICT }): RunnerClause => ({
  address: request.address,
  anchor: { kind: "file" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/audit/CD-3`,
  clauseSettings: {},
  edition: editionSchema.parse("2"),
  settings: { module: "compiler-overrides.ts" },
});

const CLAUSES: readonly RunnerClause[] = [
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
  { clause: UNCHECKED, file: LOOSENED, anchor: AT_FILE, snippet: "compilerOptions.noUncheckedIndexedAccess = false, inherited from configs/loose.json" },
  { clause: UNCHECKED, file: UNSET, anchor: AT_FILE, snippet: "compilerOptions.noUncheckedIndexedAccess unset here and in configs/partial.json" },
  { clause: EXACT, file: UNSET, anchor: AT_FILE, snippet: "compilerOptions.exactOptionalPropertyTypes unset here and in configs/partial.json" },
  { clause: OVERRIDE, file: UNSET, anchor: AT_FILE, snippet: "compilerOptions.noImplicitOverride unset here and in configs/partial.json" },
  { clause: FALLTHROUGH, file: UNSET, anchor: AT_FILE, snippet: "compilerOptions.noFallthroughCasesInSwitch unset here and in configs/partial.json" },
  { clause: PROPERTY, file: UNSET, anchor: AT_FILE, snippet: "compilerOptions.noPropertyAccessFromIndexSignature unset here and in configs/partial.json" },
  { clause: STRICT, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.strict ${MISSING_BASE}` },
  { clause: UNCHECKED, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.noUncheckedIndexedAccess ${MISSING_BASE}` },
  { clause: EXACT, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.exactOptionalPropertyTypes ${MISSING_BASE}` },
  { clause: OVERRIDE, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.noImplicitOverride ${MISSING_BASE}` },
  { clause: FALLTHROUGH, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.noFallthroughCasesInSwitch ${MISSING_BASE}` },
  { clause: PROPERTY, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.noPropertyAccessFromIndexSignature ${MISSING_BASE}` },
  { clause: CATCH, file: BROKEN, anchor: AT_FILE, snippet: `compilerOptions.useUnknownInCatchVariables ${MISSING_BASE}` },
] as const;

const EVERY_CLAUSE_ON_EVERY_TSCONFIG = [
  { clause: STRICT, file: INHERITS },
  { clause: UNCHECKED, file: INHERITS },
  { clause: EXACT, file: INHERITS },
  { clause: OVERRIDE, file: INHERITS },
  { clause: FALLTHROUGH, file: INHERITS },
  { clause: PROPERTY, file: INHERITS },
  { clause: CATCH, file: INHERITS },
  { clause: STRICT, file: LOOSENED },
  { clause: UNCHECKED, file: LOOSENED },
  { clause: EXACT, file: LOOSENED },
  { clause: OVERRIDE, file: LOOSENED },
  { clause: FALLTHROUGH, file: LOOSENED },
  { clause: PROPERTY, file: LOOSENED },
  { clause: CATCH, file: LOOSENED },
  { clause: STRICT, file: UNSET },
  { clause: UNCHECKED, file: UNSET },
  { clause: EXACT, file: UNSET },
  { clause: OVERRIDE, file: UNSET },
  { clause: FALLTHROUGH, file: UNSET },
  { clause: PROPERTY, file: UNSET },
  { clause: CATCH, file: UNSET },
  { clause: STRICT, file: BROKEN },
  { clause: UNCHECKED, file: BROKEN },
  { clause: EXACT, file: BROKEN },
  { clause: OVERRIDE, file: BROKEN },
  { clause: FALLTHROUGH, file: BROKEN },
  { clause: PROPERTY, file: BROKEN },
  { clause: CATCH, file: BROKEN },
  { clause: STRICT, file: LAYERED },
  { clause: UNCHECKED, file: LAYERED },
  { clause: EXACT, file: LAYERED },
  { clause: OVERRIDE, file: LAYERED },
  { clause: FALLTHROUGH, file: LAYERED },
  { clause: PROPERTY, file: LAYERED },
  { clause: CATCH, file: LAYERED },
  { clause: STRICT, file: SOLUTION },
  { clause: UNCHECKED, file: SOLUTION },
  { clause: EXACT, file: SOLUTION },
  { clause: OVERRIDE, file: SOLUTION },
  { clause: FALLTHROUGH, file: SOLUTION },
  { clause: PROPERTY, file: SOLUTION },
  { clause: CATCH, file: SOLUTION },
] as const;

const SINGLE_BASE_ONLY = "unknown: TS5024 Compiler option 'extends' requires a value of type string.";

describe("CD-3 edition 2 over a real extends chain on disk, through the shipped audit runner (CD-47: the fixture repository is the assertion's subject; nothing is spawned or written)", () => {
  it.each([
    {
      line: "typescript",
      layeredHits: [{ clause: OVERRIDE, file: LAYERED, anchor: AT_FILE, snippet: "compilerOptions.noImplicitOverride = false, inherited from configs/override-off.json" }],
    },
    {
      line: "typescript-floor",
      layeredHits: [
        { clause: STRICT, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.strict ${SINGLE_BASE_ONLY}` },
        { clause: UNCHECKED, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.noUncheckedIndexedAccess ${SINGLE_BASE_ONLY}` },
        { clause: EXACT, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.exactOptionalPropertyTypes ${SINGLE_BASE_ONLY}` },
        { clause: OVERRIDE, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.noImplicitOverride ${SINGLE_BASE_ONLY}` },
        { clause: FALLTHROUGH, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.noFallthroughCasesInSwitch ${SINGLE_BASE_ONLY}` },
        { clause: PROPERTY, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.noPropertyAccessFromIndexSignature ${SINGLE_BASE_ONLY}` },
        { clause: CATCH, file: LAYERED, anchor: AT_FILE, snippet: `compilerOptions.useUnknownInCatchVariables ${SINGLE_BASE_ONLY}` },
      ],
    },
  ] as const)("judges each tsconfig.json by the options it resolves to on the $line line", async ({ line, layeredHits }) => {
    const report = await auditRunnerOn({ line }).run({
      repoRoot: REPO_ROOT,
      installRoot: INSTALL_ROOT,
      files: [INHERITS, LOOSENED, UNSET, BROKEN, LAYERED, SOLUTION],
      trackedPaths: [INHERITS, LOOSENED, UNSET, BROKEN, LAYERED, SOLUTION],
      clauses: CLAUSES,
    });

    expect(report).toEqual({
      outcome: "ok",
      value: { hits: [...SHARED_HITS, ...layeredHits], nativeExceptions: [], measured: EVERY_CLAUSE_ON_EVERY_TSCONFIG },
    });
  });
});
