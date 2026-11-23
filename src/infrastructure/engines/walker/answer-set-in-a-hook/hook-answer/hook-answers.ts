import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { sourceSnippetOf } from "../../runner/pieces/source-snippet.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type { SyntaxApi, SyntaxNode } from "../../runner/toolchain/typescript-parse.ts";

type SyntaxRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const HOOKS = new Set(["beforeAll", "beforeEach", "afterEach", "afterAll"]);
const ANSWER_SETTERS = new Set([
  "mockReturnValue",
  "mockReturnValueOnce",
  "mockResolvedValue",
  "mockResolvedValueOnce",
  "mockRejectedValue",
  "mockRejectedValueOnce",
  "mockImplementation",
  "mockImplementationOnce",
  "mockReturnThis",
]);

const enclosingHook = ({ syntaxApi, node }: SyntaxRequest): "hook" | "outside" => {
  if (syntaxApi.isSourceFile(node)) return "outside";
  const parent = node.parent;
  if (
    syntaxApi.isCallExpression(parent) &&
    parent.arguments[0] === node &&
    syntaxApi.isIdentifier(parent.expression) &&
    HOOKS.has(parent.expression.text)
  )
    return "hook";
  return enclosingHook({ syntaxApi, node: parent });
};

const answerSetter = ({ syntaxApi, node }: SyntaxRequest): SyntaxNode | undefined => {
  if (!syntaxApi.isCallExpression(node) || !syntaxApi.isPropertyAccessExpression(node.expression))
    return undefined;
  const member = node.expression;
  if (ANSWER_SETTERS.has(member.name.text)) return node;
  return member.name.text === "fn" &&
    syntaxApi.isIdentifier(member.expression) &&
    member.expression.text === "vi" &&
    node.arguments.length > 0
    ? node
    : undefined;
};

export const check: WalkerPiece = {
  prepare: ({ bindings, repository, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file, testFiles: repository.testFiles }) === "skipped")
          return { outcome: "ok", value: { kind: "skipped" } };
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const setter = answerSetter({ syntaxApi, node });
                  if (
                    setter === undefined ||
                    enclosingHook({ syntaxApi, node: setter.parent }) !== "hook"
                  )
                    return;
                  const anchor = anchorAt({ position: setter.getStart(sourceFile) });
                  const snippet = sourceSnippetOf(setter.getText(sourceFile));
                  hits.push(
                    ...bindings.map(({ address }) => ({ check: address, anchor, snippet })),
                  );
                },
                finish: () => hits,
              };
            },
          },
        };
      },
      finish: () => ({ outcome: "ok", value: [] }),
    },
  }),
};
