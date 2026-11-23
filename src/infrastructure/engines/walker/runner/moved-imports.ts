import type { PathPort } from "../../../../application/ports/host/path-port.ts";
import type {
  ImportsRewrittenOf,
  SpecifierRefusal,
} from "../../../../application/ports/upgrade/version-one-team-layout.ts";
import type { RepoPath } from "../../../../domain/repository/repo-path-types.ts";
import type { Result } from "../../../../domain/result.ts";
import type {
  SyntaxApi,
  SyntaxNode,
  SyntaxTree,
  TypeScriptParsePort,
} from "./toolchain/typescript-parse.ts";

type SpecifierSite =
  | { readonly site: "literal"; readonly node: SyntaxNode; readonly text: string }
  | { readonly site: "computed"; readonly node: SyntaxNode };

type Rewrite = { readonly start: number; readonly end: number; readonly text: string };

type ResolutionCandidate = { readonly written: string; readonly onDisk: string };

type TargetForm = { readonly found: RepoPath; readonly candidate: ResolutionCandidate };

type MovedFile = {
  readonly file: RepoPath;
  readonly movedTo: RepoPath;
  readonly folder: RepoPath;
  readonly moved: ReadonlyMap<RepoPath, RepoPath>;
};

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;

const RELATIVE_SPECIFIER = /^\.\.?(\/|$)/;

const PARENT_SPECIFIER = /^\.\.(\/|$)/;

const MOCKING_RECEIVERS: ReadonlySet<string> = new Set(["vi", "jest"]);

const MOCKING_METHODS: ReadonlySet<string> = new Set([
  "mock",
  "doMock",
  "unmock",
  "importActual",
  "importMock",
  "requireActual",
]);

const REQUIRE = "require";

const ANCHOR = "/";

const CURRENT_FOLDER = ".";

const PARENT_FOLDER = "..";

const RESOLVED_EXTENSIONS: readonly string[] = [".ts", ".tsx", ".d.ts", ".js", ".jsx"];

const SOURCE_FOR_EMITTED: readonly ResolutionCandidate[] = [
  { written: ".js", onDisk: ".ts" },
  { written: ".js", onDisk: ".tsx" },
  { written: ".mjs", onDisk: ".mts" },
  { written: ".cjs", onDisk: ".cts" },
  { written: ".jsx", onDisk: ".tsx" },
];

const RESOLUTION_CANDIDATES: readonly ResolutionCandidate[] = [
  { written: "", onDisk: "" },
  ...RESOLVED_EXTENSIONS.flatMap((extension) => [
    { written: "", onDisk: extension },
    { written: "", onDisk: `/index${extension}` },
  ]),
  ...SOURCE_FOR_EMITTED,
];

const QUOTE_LENGTH = 1;

const importCallOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode | undefined =>
  request.syntaxApi.isCallExpression(request.node) &&
  request.node.expression.kind === request.syntaxApi.SyntaxKind.ImportKeyword
    ? request.node
    : undefined;

const callSpecifierOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  const [first] = node.arguments;
  if (first !== undefined && importCallOf({ syntaxApi, node: first }) !== undefined)
    return undefined;
  const named =
    importCallOf(request) !== undefined ||
    (syntaxApi.isIdentifier(callee) && callee.text === REQUIRE) ||
    (syntaxApi.isPropertyAccessExpression(callee) &&
      syntaxApi.isIdentifier(callee.expression) &&
      MOCKING_RECEIVERS.has(callee.expression.text) &&
      MOCKING_METHODS.has(callee.name.text));
  return named ? (first ?? node) : undefined;
};

const specifierNodeOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isImportDeclaration(node)) return node.moduleSpecifier;
  if (syntaxApi.isExportDeclaration(node)) return node.moduleSpecifier;
  if (
    syntaxApi.isImportEqualsDeclaration(node) &&
    syntaxApi.isExternalModuleReference(node.moduleReference)
  ) {
    return node.moduleReference.expression;
  }
  if (syntaxApi.isImportTypeNode(node)) {
    return syntaxApi.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument;
  }
  return callSpecifierOf(request);
};

const siteOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): readonly SpecifierSite[] => {
  const specifier = specifierNodeOf(request);
  if (specifier === undefined) return [];
  return request.syntaxApi.isStringLiteralLike(specifier)
    ? [{ site: "literal", node: specifier, text: specifier.text }]
    : [{ site: "computed", node: specifier }];
};

const sitesOf = (request: {
  readonly parse: TypeScriptParsePort;
  readonly node: SyntaxNode;
}): readonly SpecifierSite[] => [
  ...siteOf({ syntaxApi: request.parse.syntaxApi, node: request.node }),
  ...request.parse
    .children({ node: request.node })
    .flatMap((child) => sitesOf({ parse: request.parse, node: child })),
];

const anchored = (path: string): string => `${ANCHOR}${path}`;

const TRAILING_SEPARATORS = /\/+$/;

const unanchored = (path: string): string =>
  path.slice(ANCHOR.length).replace(TRAILING_SEPARATORS, "");

const targetFormOf = (request: {
  readonly target: string;
  readonly moved: ReadonlyMap<RepoPath, RepoPath>;
}): TargetForm | undefined => {
  const [form] = RESOLUTION_CANDIDATES.filter(({ written }) =>
    request.target.endsWith(written),
  ).flatMap((candidate) => {
    const path = `${request.target.slice(0, request.target.length - candidate.written.length)}${candidate.onDisk}`;
    return [...request.moved.keys()]
      .filter((key) => key === path)
      .map((found) => ({ found, candidate }));
  });
  return form;
};

const writtenTargetOf = (request: {
  readonly to: RepoPath;
  readonly candidate: ResolutionCandidate;
}): string =>
  `${request.to.slice(0, request.to.length - request.candidate.onDisk.length)}${request.candidate.written}`;

const segmentsOf = (path: string): readonly string[] =>
  path.split(ANCHOR).filter((segment) => segment !== "");

const relativeBetween = (request: { readonly from: string; readonly to: string }): string => {
  const from = segmentsOf(request.from);
  const to = segmentsOf(request.to);
  const diverging = from.findIndex((segment, index) => to[index] !== segment);
  const shared = diverging === -1 ? from.length : diverging;
  return [...from.slice(shared).map(() => PARENT_FOLDER), ...to.slice(shared)].join(ANCHOR);
};

const specifierTextOf = (relative: string): string => {
  if (relative === "") return CURRENT_FOLDER;
  return PARENT_SPECIFIER.test(relative) ? relative : `${CURRENT_FOLDER}${ANCHOR}${relative}`;
};

const lineOf = (request: { readonly tree: SyntaxTree; readonly node: SyntaxNode }): number =>
  request.tree.getLineAndCharacterOfPosition(request.node.getStart(request.tree)).line + 1;

const refusedAt = (request: {
  readonly tree: SyntaxTree;
  readonly node: SyntaxNode;
  readonly reason: SpecifierRefusal["reason"];
}): Result<never, SpecifierRefusal> => ({
  outcome: "failed",
  error: { reason: request.reason, line: lineOf(request) },
});

const destinationOf = (
  request: MovedFile & { readonly path: PathPort; readonly target: string },
): string | "not-moved" => {
  const form = targetFormOf(request);
  const to = form === undefined ? undefined : request.moved.get(form.found);
  if (form !== undefined && to !== undefined) {
    return writtenTargetOf({ to, candidate: form.candidate });
  }
  const inFolder =
    request.target === request.folder || request.target.startsWith(`${request.folder}${ANCHOR}`);
  return inFolder ? "not-moved" : request.target;
};

const rewriteOf = (
  request: MovedFile & {
    readonly path: PathPort;
    readonly tree: SyntaxTree;
    readonly site: SpecifierSite;
  },
): Result<readonly Rewrite[], SpecifierRefusal> => {
  const { path, tree, site } = request;
  if (site.site === "computed") {
    return refusedAt({ tree, node: site.node, reason: "specifier-not-literal" });
  }
  if (!RELATIVE_SPECIFIER.test(site.text)) return { outcome: "ok", value: [] };
  const target = unanchored(
    path.join({ segments: [path.directoryOf({ path: anchored(request.file) }), site.text] }),
  );
  const destination = destinationOf({ ...request, target });
  if (destination === "not-moved") {
    return refusedAt({ tree, node: site.node, reason: "target-not-moved" });
  }
  return {
    outcome: "ok",
    value: [
      {
        start: site.node.getStart(tree) + QUOTE_LENGTH,
        end: site.node.getEnd() - QUOTE_LENGTH,
        text: specifierTextOf(
          relativeBetween({
            from: path.directoryOf({ path: anchored(request.movedTo) }),
            to: destination,
          }),
        ),
      },
    ],
  };
};

const rewrittenText = (request: {
  readonly text: string;
  readonly rewrites: readonly Rewrite[];
}): string =>
  request.rewrites.reduceRight(
    (text, rewrite) => `${text.slice(0, rewrite.start)}${rewrite.text}${text.slice(rewrite.end)}`,
    request.text,
  );

export const createImportsRewrittenOf =
  (options: { readonly path: PathPort; readonly parse: TypeScriptParsePort }): ImportsRewrittenOf =>
  (request) => {
    if (!SCRIPT_FILE.test(request.file)) return { outcome: "ok", value: request.text };
    const tree = options.parse.parse({ fileName: request.file, source: request.text });
    const rewrites = sitesOf({ parse: options.parse, node: tree }).map((site) =>
      rewriteOf({ ...request, path: options.path, tree, site }),
    );
    const refused = rewrites.find((rewrite) => rewrite.outcome === "failed");
    if (refused?.outcome === "failed") return refused;
    return {
      outcome: "ok",
      value: rewrittenText({
        text: request.text,
        rewrites: rewrites
          .flatMap((rewrite) => (rewrite.outcome === "ok" ? rewrite.value : []))
          .toSorted((left, right) => left.start - right.start),
      }),
    };
  };
