import { sourceBindingsPerFile } from "../../runner/pieces/source-bindings.ts";
import {
  testFileEligibility,
  typeScriptSourceEligibility,
} from "../../runner/pieces/source-scope.ts";
import { calleeRootOf } from "../../runner/pieces/syntax-callee-root.ts";
import { type SyntaxVisit, syntaxNodeCheck } from "../../runner/pieces/syntax-node-check.ts";
import {
  outermostParenthesesOf,
  withoutParentheses,
} from "../../runner/pieces/syntax-parentheses.ts";
import { vitestImportedNameOf } from "../../runner/pieces/vitest-import.ts";
import type { WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type {
  Identifier,
  ImportSpecifier,
  SyntaxApi,
  SyntaxTree,
  TypeChecker,
} from "../../runner/toolchain/typescript-parse.ts";

type NodeVisit = Pick<SyntaxVisit, "syntaxApi" | "node">;
type TestContext = NodeVisit & { readonly bindingsOf: () => TypeChecker };
type TestBinding = TestContext & { readonly visited: ReadonlySet<NodeVisit["node"]> };

const EXPECT_METHODS = new Set(["soft", "poll", "assertions", "hasAssertions", "unreachable"]);

const targetOf = ({ syntaxApi, node }: NodeVisit) => {
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (syntaxApi.isIdentifier(callee)) return { root: callee, method: undefined };
  if (syntaxApi.isPropertyAccessExpression(callee) && syntaxApi.isIdentifier(callee.expression)) {
    return { root: callee.expression, method: callee.name.text };
  }
  return undefined;
};

const isTestName = (name: string | undefined): boolean => name === "it" || name === "test";

const firstMemberNameOf = (
  request: NodeVisit & { readonly root: Identifier },
): string | undefined => {
  const { syntaxApi, root } = request;
  const receiver = outermostParenthesesOf({ syntaxApi, node: root });
  const member = receiver.parent;
  if (syntaxApi.isPropertyAccessExpression(member) && member.expression === receiver)
    return member.name.text;
  if (
    syntaxApi.isElementAccessExpression(member) &&
    member.expression === receiver &&
    syntaxApi.isStringLiteralLike(member.argumentExpression)
  )
    return member.argumentExpression.text;
  return undefined;
};

const extendedTestOf = (request: TestBinding): "test" | "other" => {
  const { syntaxApi, node, visited } = request;
  if (visited.has(node)) return "other";
  if (!syntaxApi.isVariableDeclaration(node) || node.initializer === undefined) return "other";
  if (!syntaxApi.isVariableDeclarationList(node.parent)) return "other";
  if ((node.parent.flags & syntaxApi.NodeFlags.Const) === 0) return "other";
  const value = withoutParentheses({ syntaxApi, node: node.initializer });
  if (!syntaxApi.isCallExpression(value) || !syntaxApi.isPropertyAccessExpression(value.expression))
    return "other";
  if (value.expression.name.text !== "extend") return "other";
  const root = calleeRootOf({ syntaxApi, node: value.expression.expression });
  return root === undefined
    ? "other"
    : testBindingOf({ ...request, root, visited: new Set([...visited, node]) });
};

const testBindingOf = (request: TestBinding & { readonly root: Identifier }): "test" | "other" => {
  const { bindingsOf, root, syntaxApi } = request;
  const declarations = bindingsOf().getSymbolAtLocation(root)?.declarations ?? [];
  if (declarations.length === 0) return isTestName(root.text) ? "test" : "other";
  return declarations.some((node) => {
    const imported = vitestImportedNameOf({ syntaxApi, node });
    return (
      isTestName(imported) ||
      (imported === "*" && isTestName(firstMemberNameOf(request))) ||
      extendedTestOf({ ...request, node }) === "test"
    );
  })
    ? "test"
    : "other";
};

const argumentOfTest = (request: TestContext): boolean => {
  const { syntaxApi, node } = request;
  const callback = outermostParenthesesOf({ syntaxApi, node });
  const parent = callback.parent;
  if (
    !syntaxApi.isCallExpression(parent) ||
    !parent.arguments.slice(1).some((argument) => argument === callback)
  )
    return false;
  const root = calleeRootOf({ syntaxApi, node: parent.expression });
  return root !== undefined && testBindingOf({ ...request, root, visited: new Set() }) === "test";
};

const insideTest = (request: TestContext): boolean => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isSourceFile(node)) return false;
  return (
    (syntaxApi.isFunctionLike(node) && argumentOfTest(request)) ||
    insideTest({ ...request, node: node.parent })
  );
};

const vitestAssertionsOf = ({ syntaxApi, sourceFile }: Omit<SyntaxVisit, "node">) =>
  new Map(
    sourceFile.statements.flatMap((statement) => {
      if (!syntaxApi.isImportDeclaration(statement)) return [];
      const bindings = statement.importClause?.namedBindings;
      if (bindings === undefined || !syntaxApi.isNamedImports(bindings)) return [];
      return bindings.elements.flatMap<
        readonly [string, { readonly name: string; readonly declaration: ImportSpecifier }]
      >((declaration) => {
        const name = vitestImportedNameOf({ syntaxApi, node: declaration });
        return name === "expect" || name === "assert"
          ? [[declaration.name.text, { name, declaration }]]
          : [];
      });
    }),
  );

const assertsAt = (request: {
  readonly name: string | undefined;
  readonly method: string | undefined;
}): boolean =>
  request.name === "assert" ||
  (request.name === "expect" &&
    (request.method === undefined || EXPECT_METHODS.has(request.method)));

export const check: WalkerPiece = {
  prepare: (request) => {
    const sourceImports = new WeakMap<SyntaxTree, ReturnType<typeof vitestAssertionsOf>>();
    const fileBindingsOf = sourceBindingsPerFile();
    return syntaxNodeCheck({
      eligibility: typeScriptSourceEligibility,
      found: (visit) => {
        const target = targetOf(visit);
        if (target === undefined) return undefined;
        const { root, method } = target;
        const { syntaxApi, sourceFile } = visit;
        const bindingsOf = (): TypeChecker => fileBindingsOf({ syntaxApi, sourceFile });
        const test =
          testFileEligibility({
            file: sourceFile.fileName,
            testFiles: request.repository.testFiles,
          }) === "eligible";
        if (
          test &&
          assertsAt({ name: root.text, method }) &&
          (bindingsOf().getSymbolAtLocation(root)?.declarations?.length ?? 0) === 0
        ) {
          return insideTest({ ...visit, bindingsOf })
            ? undefined
            : { at: root, snippet: root.text };
        }

        const imports =
          sourceImports.get(sourceFile) ?? vitestAssertionsOf({ syntaxApi, sourceFile });
        sourceImports.set(sourceFile, imports);
        const imported = imports.get(root.text);
        if (imported === undefined || !assertsAt({ name: imported.name, method })) return undefined;
        if (insideTest({ ...visit, bindingsOf })) return undefined;
        return bindingsOf().getSymbolAtLocation(root)?.declarations?.includes(imported.declaration)
          ? { at: root, snippet: root.text }
          : undefined;
      },
    }).prepare(request);
  },
};
