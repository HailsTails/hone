import type { Result } from "../../../src/domain/result.ts";
import type { TypedExport } from "../published-manifest/published-manifest.ts";

export type PublicTypeEntry = { readonly subpath: string; readonly source: string };

export type EmittedDeclaration = {
  readonly path: string;
  readonly text: string;
  readonly specifiers: readonly string[];
  readonly refusals: readonly string[];
};

export type DeclarationEmit = { readonly declarations: readonly EmittedDeclaration[]; readonly diagnostics: readonly string[] };

export type DeclarationFailure = { readonly kind: "declarations-failed"; readonly detail: string };

export type DeclarationPort = {
  readonly emit: (request: {
    readonly sourceRoot: string;
    readonly entryPoints: readonly string[];
  }) => Promise<Result<DeclarationEmit, DeclarationFailure>>;
};

export type PublishedFile = { readonly path: string; readonly text: string };

export const PUBLIC_TYPE_ENTRIES: readonly PublicTypeEntry[] = [
  { subpath: "walker", source: "src/audit.ts" },
  { subpath: "eslint-plugin", source: "src/eslint-plugin.ts" },
  { subpath: "rule-set", source: "src/rule-set.ts" },
  { subpath: "testing", source: "src/testing.ts" },
];

const SOURCE_EXTENSION = /\.ts$/;

const MODULE_EXTENSION = /\.js$/;

const DECLARATION_EXTENSION = ".d.ts";

const BUILT_ENTRY_EXTENSION = ".js";

const RELATIVE_SPECIFIER = /^\.\.?\//;

const declarationPathOf = (request: { readonly source: string }): string => request.source.replace(SOURCE_EXTENSION, DECLARATION_EXTENSION);

const modulePathOf = (request: { readonly source: string }): string => request.source.replace(SOURCE_EXTENSION, BUILT_ENTRY_EXTENSION);

export const typedExportOf = (request: { readonly entry: PublicTypeEntry }): TypedExport => ({
  subpath: request.entry.subpath,
  declaration: declarationPathOf(request.entry),
  module: modulePathOf(request.entry),
});

export const declarationReachedBy = (request: { readonly from: string; readonly specifier: string }): string | undefined =>
  RELATIVE_SPECIFIER.test(request.specifier)
    ? new URL(request.specifier, `file:///${request.from}`).pathname.slice(1).replace(MODULE_EXTENSION, DECLARATION_EXTENSION)
    : undefined;

const specifiersOf = (request: {
  readonly declarations: ReadonlyMap<string, EmittedDeclaration>;
  readonly path: string;
}): readonly string[] => request.declarations.get(request.path)?.specifiers ?? [];

const reachedFrom = (request: {
  readonly declarations: ReadonlyMap<string, EmittedDeclaration>;
  readonly reached: ReadonlySet<string>;
  readonly frontier: readonly string[];
}): ReadonlySet<string> => {
  const next = [
    ...new Set(
      request.frontier.flatMap((from) =>
        specifiersOf({ declarations: request.declarations, path: from }).flatMap((specifier) => {
          const reached = declarationReachedBy({ from, specifier });
          return reached === undefined || request.reached.has(reached) ? [] : [reached];
        }),
      ),
    ),
  ];
  return next.length === 0
    ? request.reached
    : reachedFrom({ declarations: request.declarations, reached: new Set([...request.reached, ...next]), frontier: next });
};

const declarationsByPath = (request: {
  readonly declarations: readonly EmittedDeclaration[];
}): ReadonlyMap<string, EmittedDeclaration> => new Map(request.declarations.map((declaration) => [declaration.path, declaration]));

export const reachableDeclarations = (request: {
  readonly declarations: readonly EmittedDeclaration[];
  readonly roots: readonly string[];
}): readonly string[] =>
  [...reachedFrom({ declarations: declarationsByPath(request), reached: new Set(request.roots), frontier: request.roots })].sort();

const packageImportProblems = (request: {
  readonly declarations: ReadonlyMap<string, EmittedDeclaration>;
  readonly reached: readonly string[];
  readonly requiredPeers: readonly string[];
}): readonly string[] =>
  request.reached.flatMap((path) =>
    specifiersOf({ declarations: request.declarations, path })
      .filter((specifier) => !RELATIVE_SPECIFIER.test(specifier) && !request.requiredPeers.includes(specifier))
      .map((specifier) => `${path} imports ${specifier}, which is neither shipped nor a required peer`),
  );

const publicationProblems = (request: {
  readonly emit: DeclarationEmit;
  readonly declarations: ReadonlyMap<string, EmittedDeclaration>;
  readonly reached: readonly string[];
  readonly requiredPeers: readonly string[];
}): readonly string[] => [
  ...request.emit.diagnostics.map((diagnostic) => `declaration emit reported: ${diagnostic}`),
  ...request.reached.flatMap((path) => (request.declarations.get(path)?.refusals ?? []).map((refusal) => `declaration emit reported: ${refusal}`)),
  ...request.reached.filter((path) => !request.declarations.has(path)).map((path) => `${path} is reached but was not emitted`),
  ...packageImportProblems(request),
];

export const publishedDeclarationsOf = (request: {
  readonly emit: DeclarationEmit;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): Result<readonly PublishedFile[], readonly string[]> => {
  const declarations = declarationsByPath({ declarations: request.emit.declarations });
  const reached = reachableDeclarations({
    declarations: request.emit.declarations,
    roots: request.entries.map((entry) => declarationPathOf(entry)),
  });
  const problems = publicationProblems({ emit: request.emit, declarations, reached, requiredPeers: request.requiredPeers });
  return problems.length > 0
    ? { outcome: "failed", error: problems }
    : {
        outcome: "ok",
        value: reached.flatMap((path) => {
          const shipped = declarations.get(path);
          return shipped === undefined ? [] : [{ path, text: shipped.text }];
        }),
      };
};

export const declarationFilesOf = async (request: {
  readonly port: DeclarationPort;
  readonly sourceRoot: string;
  readonly entries: readonly PublicTypeEntry[];
  readonly requiredPeers: readonly string[];
}): Promise<Result<readonly PublishedFile[], string>> => {
  const emitted = await request.port.emit({ sourceRoot: request.sourceRoot, entryPoints: request.entries.map((entry) => entry.source) });
  if (emitted.outcome === "failed") {
    return { outcome: "failed", error: `FAIL: emit declarations: ${emitted.error.detail}` };
  }
  const published = publishedDeclarationsOf({ emit: emitted.value, entries: request.entries, requiredPeers: request.requiredPeers });
  return published.outcome === "failed"
    ? { outcome: "failed", error: `FAIL: publish declarations: ${published.error.join("; ")}` }
    : published;
};
