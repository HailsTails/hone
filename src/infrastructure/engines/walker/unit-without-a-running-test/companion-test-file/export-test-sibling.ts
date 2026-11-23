import type { TestFiles } from "../../../../../domain/settings/test-files.ts";
import { fileRoleOf, folderScope } from "../../runner/pieces/source-scope.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";

type TestFilesRequest = { readonly file: string; readonly testFiles: TestFiles };

const productionFileEligibility = (request: TestFilesRequest): "eligible" | "skipped" => {
  const directories = request.file.split("/").slice(0, -1);
  if (
    (!request.file.endsWith(".ts") && !request.file.endsWith(".tsx")) ||
    fileRoleOf(request) === "test" ||
    request.file.endsWith(".d.ts") ||
    directories.includes("__tests__") ||
    folderScope({ file: request.file }) === "generated"
  )
    return "skipped";
  return "eligible";
};

const EXTENSION = /\.tsx?$/;

const testSiblingsOf = (request: TestFilesRequest): readonly string[] =>
  request.testFiles.suffixes.map((suffix) =>
    request.file.replace(EXTENSION, (extension) => `.${suffix}${extension}`),
  );

const missingSiblingSnippet = (request: { readonly testFiles: TestFiles }): string =>
  `missing co-located *.${request.testFiles.suffixes[0]}.ts(x) sibling`;

export const check: WalkerPiece = {
  prepare: ({ bindings, repository, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        const { testFiles } = repository;
        if (productionFileEligibility({ file, testFiles }) === "skipped") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hasRuntimeExport = sourceFile.statements.some((statement) => {
                if (syntaxApi.isExportAssignment(statement)) return true;
                const modifierKinds = (
                  syntaxApi.canHaveModifiers(statement)
                    ? (syntaxApi.getModifiers(statement) ?? [])
                    : []
                ).map((modifier) => modifier.kind);
                if (
                  [
                    syntaxApi.SyntaxKind.VariableStatement,
                    syntaxApi.SyntaxKind.FunctionDeclaration,
                    syntaxApi.SyntaxKind.ClassDeclaration,
                    syntaxApi.SyntaxKind.EnumDeclaration,
                  ].includes(statement.kind) &&
                  modifierKinds.includes(syntaxApi.SyntaxKind.ExportKeyword) &&
                  !modifierKinds.includes(syntaxApi.SyntaxKind.DeclareKeyword)
                )
                  return true;
                return (
                  syntaxApi.isExportDeclaration(statement) &&
                  !statement.isTypeOnly &&
                  statement.exportClause !== undefined &&
                  syntaxApi.isNamedExports(statement.exportClause) &&
                  statement.exportClause.elements.some((specifier) => !specifier.isTypeOnly)
                );
              });
              const siblings = testSiblingsOf({ file, testFiles });
              const hasSibling = repository.files.some((candidate) => siblings.includes(candidate));
              return {
                finish: () =>
                  hasRuntimeExport && !hasSibling
                    ? bindings.map((binding) => ({
                        check: binding.address,
                        anchor: anchorAt({ position: 0 }),
                        snippet: missingSiblingSnippet({ testFiles }),
                      }))
                    : [],
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
