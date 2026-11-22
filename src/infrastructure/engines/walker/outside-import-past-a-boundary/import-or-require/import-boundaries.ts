import type { PieceFailure } from "../../../../../domain/runner/piece-failure-types.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import type { Result } from "../../../../../domain/result.ts";
import type { SyntaxApi, SyntaxNode, SyntaxTree } from "../../runner/toolchain/typescript-parse.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import { folderScope } from "../../runner/pieces/source-scope.ts";
import { gatheredOutcomes } from "../../../../../domain/gathered-outcomes.ts";
import { stringListClauseSettings } from "../../runner/pieces/piece-clause-settings.ts";

const sourceEligibility = (request: { readonly file: string }): "eligible" | "excluded" => {
  if (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) return "excluded";
  if (folderScope({ file: request.file }) === "generated") return "excluded";
  return "eligible";
};

type ConfinedPattern = { readonly pattern: RegExp };

type ConfinedClause = {
  readonly clause: RunnerClause;
  readonly anywhere: RegExp | undefined;
  readonly patterns: readonly ConfinedPattern[];
};

const escapedPackage = (request: { readonly packageName: string }): string =>
  request.packageName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const confinedImportPattern = (request: { readonly packageNames: readonly string[] }): RegExp =>
  new RegExp(
    `from\\s+["']((?:${request.packageNames.map((packageName) => escapedPackage({ packageName })).join("|")})(?:/[^"']*)?)["']`,
  );

const confinedClauseOf = (request: {
  readonly clause: RunnerClause;
  readonly packageNames: readonly string[];
}): ConfinedClause => ({
  clause: request.clause,
  anywhere: request.packageNames.length === 0 ? undefined : confinedImportPattern({ packageNames: request.packageNames }),
  patterns: request.packageNames.map((packageName) => ({ pattern: confinedImportPattern({ packageNames: [packageName] }) })),
});

const confinedImportsIn = (request: {
  readonly text: string;
  readonly confined: ConfinedClause;
}): readonly { readonly line: number; readonly specifier: string }[] => {
  if (request.confined.anywhere === undefined || !request.confined.anywhere.test(request.text)) return [];
  return request.text.split("\n").flatMap((text, index) =>
    request.confined.patterns.flatMap(({ pattern }) => {
      const specifier = pattern.exec(text)?.[1];
      return specifier === undefined ? [] : [{ line: index + 1, specifier }];
    }),
  );
};

const confinedImportHits = (request: {
  readonly text: string;
  readonly confined: readonly ConfinedClause[];
}): readonly PieceHit[] =>
  request.confined.flatMap((confined) =>
    confinedImportsIn({ text: request.text, confined }).map(({ line, specifier }) => ({
      clause: confined.clause.address,
      anchor: { line, column: 0 },
      snippet: `banned third-party import: ${specifier} — use its recorded wrapping boundary`,
      importSpecifier: specifier,
    })),
  );

const NODE_SCHEME = "node:";

const loadCallSpecifierOf = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): SyntaxNode | undefined => {
  const { node, syntaxApi } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  const loads = callee.kind === syntaxApi.SyntaxKind.ImportKeyword || (syntaxApi.isIdentifier(callee) && callee.text === "require");
  return loads ? node.arguments[0] : undefined;
};

const moduleSpecifierOf = (request: { readonly node: SyntaxNode; readonly syntaxApi: SyntaxApi }): SyntaxNode | undefined => {
  const { node, syntaxApi } = request;
  if (syntaxApi.isImportDeclaration(node) || syntaxApi.isExportDeclaration(node)) return node.moduleSpecifier;
  if (syntaxApi.isImportTypeNode(node) && syntaxApi.isLiteralTypeNode(node.argument)) return node.argument.literal;
  if (syntaxApi.isImportEqualsDeclaration(node) && syntaxApi.isExternalModuleReference(node.moduleReference)) return node.moduleReference.expression;
  return loadCallSpecifierOf(request);
};

type NodeSchemeImport = { readonly specifier: string; readonly position: number };

const nodeSchemeImportOf = (request: {
  readonly node: SyntaxNode;
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxTree;
}): NodeSchemeImport | undefined => {
  const specifier = moduleSpecifierOf(request);
  if (specifier === undefined || !request.syntaxApi.isStringLiteralLike(specifier) || !specifier.text.startsWith(NODE_SCHEME)) return undefined;
  return { specifier: specifier.text, position: specifier.getStart(request.sourceFile) };
};

const nodeSchemeHits = (request: {
  readonly clauses: readonly RunnerClause[];
  readonly anchor: PieceHit["anchor"];
  readonly specifier: string;
}): readonly PieceHit[] => {
  const snippet = `bare node: stdlib import - confined; only a wrapping file this repository records as an authorised location may import it: ${request.specifier}`;
  return request.clauses.map((clause) => ({ clause: clause.address, anchor: request.anchor, snippet, importSpecifier: request.specifier }));
};

const confinedClausesOf = (request: {
  readonly clauses: readonly RunnerClause[];
}): Result<readonly ConfinedClause[], PieceFailure> =>
  gatheredOutcomes({
    outcomes: request.clauses.map((clause): Result<readonly ConfinedClause[], PieceFailure> => {
      const settings = stringListClauseSettings({ clause, keys: ["confinedPackages"] });
      if (settings.outcome === "failed") return settings;
      return { outcome: "ok", value: [confinedClauseOf({ clause, packageNames: settings.value.confinedPackages })] };
    }),
  });

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => {
    const settled = confinedClausesOf({ clauses });
    if (settled.outcome === "failed") return settled;
    const confined = settled.value;
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file }) => {
          if (sourceEligibility({ file }) === "excluded") return { outcome: "ok", value: { kind: "skipped" } };
          return {
            outcome: "ok",
            value: {
              kind: "syntax",
              begin: ({ sourceFile, anchorAt }) => {
                const rawHits = confinedImportHits({ text: sourceFile.text, confined });
                const nodeHits: PieceHit[] = [];
                return {
                  enter: ({ node }) => {
                    const imported = nodeSchemeImportOf({ node, syntaxApi, sourceFile });
                    if (imported === undefined) return;
                    nodeHits.push(...nodeSchemeHits({ clauses, anchor: anchorAt({ position: imported.position }), specifier: imported.specifier }));
                  },
                  finish: () => [...rawHits, ...nodeHits],
                };
              },
            },
          };
        },
        finish: () => ({ outcome: "ok", value: [] }),
      },
    };
  },
};
