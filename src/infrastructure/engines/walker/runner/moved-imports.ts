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

type TargetForm = { readonly found: RepoPath; readonly suffix: string };

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

const ADDED_SUFFIXES: readonly string[] = ["", ".ts", "/index.ts"];

const JS_FOR_TS = "js-for-ts";

const JS_EXTENSION = /\.js$/;

const TS_EXTENSION = ".ts";

const TS_FILE = /\.ts$/;

const QUOTE_LENGTH = 1;

const callSpecifierOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly node: SyntaxNode;
}): SyntaxNode | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  const [first] = node.arguments;
  const named =
    callee.kind === syntaxApi.SyntaxKind.ImportKeyword ||
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
  const forms = [
    ...ADDED_SUFFIXES.map((suffix) => ({ path: `${request.target}${suffix}`, suffix })),
    { path: request.target.replace(JS_EXTENSION, TS_EXTENSION), suffix: JS_FOR_TS },
  ];
  const [form] = forms.flatMap(({ path, suffix }) =>
    [...request.moved.keys()].filter((key) => key === path).map((found) => ({ found, suffix })),
  );
  return form;
};

const writtenTargetOf = (request: { readonly to: RepoPath; readonly suffix: string }): string => {
  if (request.suffix === JS_FOR_TS) return request.to.replace(TS_FILE, ".js");
  return request.suffix === "" ? request.to : request.to.slice(0, -request.suffix.length);
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
  if (form !== undefined && to !== undefined) return writtenTargetOf({ to, suffix: form.suffix });
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
  const relative = path.relative({
    from: path.directoryOf({ path: anchored(request.movedTo) }),
    to: anchored(destination),
  });
  if (relative.relation === "different-root") {
    return refusedAt({ tree, node: site.node, reason: "target-not-moved" });
  }
  return {
    outcome: "ok",
    value: [
      {
        start: site.node.getStart(tree) + QUOTE_LENGTH,
        end: site.node.getEnd() - QUOTE_LENGTH,
        text: specifierTextOf(relative.path),
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
