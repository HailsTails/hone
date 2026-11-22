import type { PieceHit, WalkerPiece } from "../runner/pieces/walker-piece.ts";
import { folderScope } from "../runner/pieces/source-scope.ts";
import type { CallExpression, PropertyAccessExpression, SyntaxApi, SyntaxNode } from "../runner/toolchain/typescript-parse.ts";
import { editionReaches } from "../../../../domain/rule-set/edition-reach.ts";
import type { Edition } from "../../../../domain/rule-set/edition-types.ts";
import { editionOf } from "../../../../domain/rule-set/edition-of.ts";

const testFileEligibility = (request: { readonly file: string }): "eligible" | "skipped" => {
  if (folderScope({ file: request.file }) === "generated") return "skipped";
  return request.file.endsWith(".test.ts") || request.file.endsWith(".test.tsx") ? "eligible" : "skipped";
};

type Remedy = NonNullable<PieceHit["remedy"]>;

export type TestBodyForm = {
  readonly introducedIn: Edition;
  readonly remedy: Remedy;
};

type FormRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

const SECOND_EDITION: Edition = editionOf("2");

const BRANCH_IN_A_TEST = "branch-in-a-test/test-body.md";

const COMPUTED_VALUE_IN_A_TEST = "computed-value-in-a-test/test-body.md";

const REBINDING = "rebinding/test-body.md";

const TEXT_PAST_ITS_READER = "text-past-its-reader/test-body.md";

const THROW_OR_CATCH_IN_A_TEST = "throw-or-catch-in-a-test/try-block.md";

const DOUBLE_WITH_A_BODY = "double-with-a-body/logic-in-a-passed-function.md";

const firstEdition = (remedy: Remedy): TestBodyForm => ({ introducedIn: editionOf("1"), remedy });

const secondEdition = (remedy: Remedy): TestBodyForm => ({ introducedIn: SECOND_EDITION, remedy });

const BRANCHING = firstEdition({
  fix: "write one test per case, or one it.each table; to narrow a value that may be missing, assert.isDefined it",
  page: BRANCH_IN_A_TEST, section: "branching-with-if",
});
const TRY_BLOCK = firstEdition({
  fix: "assert the throw with expect(() => act()).toThrow or await expect(act()).rejects, or assert the failure the unit returns",
  page: THROW_OR_CATCH_IN_A_TEST, section: "a-try-block",
});
const TERNARY = firstEdition({ fix: "write the value out, or give each case its own it.each row", page: BRANCH_IN_A_TEST, section: "a-ternary" });
const LET = firstEdition({ fix: "use const; record calls with vi.fn and assert them with toHaveBeenCalledWith", page: REBINDING, section: "a-let" });
const PICKING_METHOD = firstEdition({
  fix: "assert on the whole array with toEqual, toContain, toContainEqual or expect.arrayContaining",
  page: COMPUTED_VALUE_IN_A_TEST, section: "a-method-that-picks-or-tests-an-element",
});
const COMPUTING_METHOD = firstEdition({
  fix: "write the expected value out, or match part of it with toMatchObject, toHaveLength or expect.stringContaining",
  page: COMPUTED_VALUE_IN_A_TEST, section: "a-method-that-computes-a-value",
});
const MUTATING_METHOD = firstEdition({ fix: "write the finished array out as a literal", page: COMPUTED_VALUE_IN_A_TEST, section: "a-method-that-mutates" });
const SHORT_CIRCUIT = secondEdition({
  fix: "write the value it gives; to narrow a value that may be missing, assert.isDefined it",
  page: BRANCH_IN_A_TEST, section: "a-short-circuit",
});
const INDEXED_OPTIONAL_CHAIN = secondEdition({
  fix: "compare the whole element with toMatchObject, or destructure it and assert.isDefined it before reading it",
  page: BRANCH_IN_A_TEST, section: "an-optional-chain-after-an-index",
});
const MOCK_CALL_OPTIONAL_CHAIN = secondEdition({
  fix: "assert the call with toHaveBeenNthCalledWith or toHaveBeenLastCalledWith",
  page: BRANCH_IN_A_TEST, section: "an-optional-chain-on-a-mock-call",
});
const MOCK_RESULT_OPTIONAL_CHAIN = secondEdition({
  fix: "assert what it returned with toHaveNthReturnedWith or toHaveLastReturnedWith",
  page: BRANCH_IN_A_TEST, section: "an-optional-chain-on-a-mock-result",
});
const PROPERTY_OPTIONAL_CHAIN = secondEdition({
  fix: "compare the whole value with toMatchObject, or destructure it and assert.isDefined it before reading it",
  page: BRANCH_IN_A_TEST, section: "an-optional-chain-on-a-property",
});
const OPTIONAL_CALL = secondEdition({ fix: "assert.isDefined the function, then call it", page: BRANCH_IN_A_TEST, section: "an-optional-call" });
const SWITCH = secondEdition({ fix: "write one test per case, or one it.each table", page: BRANCH_IN_A_TEST, section: "a-switch" });
const JSON_CALL = secondEdition({
  fix: "assert the object the unit gives back, written out; a unit that gives back only text should hand over an object, leaving the text to the adapter at its edge",
  page: TEXT_PAST_ITS_READER, section: "serialising-or-parsing-json",
});
const OBJECT_ASSIGN = secondEdition({ fix: "write the object out, spreading what it copies; to give an Error a property, assign it", page: COMPUTED_VALUE_IN_A_TEST, section: "merging-objects" });
const OBJECT_FROM_ENTRIES = secondEdition({ fix: "write the object out as a literal", page: COMPUTED_VALUE_IN_A_TEST, section: "building-an-object-from-entries" });
const ARRAY_FROM = secondEdition({ fix: "write a short array out as a literal; the page shows no form for a long one", page: COMPUTED_VALUE_IN_A_TEST, section: "building-an-array-from-a-length" });
const MATH_CALL = secondEdition({ fix: "write the number out", page: COMPUTED_VALUE_IN_A_TEST, section: "a-math-call" });
const PASSED_ON_FUNCTION: Remedy = {
  fix: "make it a vi.fn spy with a written-out mockReturnValue, and assert what it was asked with toHaveBeenCalledExactlyOnceWith; the recipe is Stub with vi.fn",
  page: DOUBLE_WITH_A_BODY,
  section: "logic-inside-a-function-the-test-passes-on",
};

const FORMS_IN_PAGE_ORDER: readonly TestBodyForm[] = [
  BRANCHING,
  TRY_BLOCK,
  TERNARY,
  LET,
  PICKING_METHOD,
  COMPUTING_METHOD,
  MUTATING_METHOD,
  SHORT_CIRCUIT,
  INDEXED_OPTIONAL_CHAIN,
  MOCK_CALL_OPTIONAL_CHAIN,
  MOCK_RESULT_OPTIONAL_CHAIN,
  PROPERTY_OPTIONAL_CHAIN,
  OPTIONAL_CALL,
  SWITCH,
  JSON_CALL,
  OBJECT_ASSIGN,
  OBJECT_FROM_ENTRIES,
  ARRAY_FROM,
  MATH_CALL,
];

export const TEST_BODY_REMEDIES: readonly Remedy[] = [...FORMS_IN_PAGE_ORDER.map((form) => form.remedy), PASSED_ON_FUNCTION];

export const TEST_BODY_SECTIONS: readonly string[] = TEST_BODY_REMEDIES.map((remedy) => remedy.section);

const PICKING_METHODS: readonly string[] = [
  "at", "every", "filter", "find", "findIndex", "findLast", "findLastIndex", "includes", "indexOf", "lastIndexOf", "some",
];
const COMPUTING_METHODS: readonly string[] = [
  "charAt", "charCodeAt", "codePointAt", "concat", "endsWith", "entries", "flat", "flatMap", "forEach", "join", "keys",
  "localeCompare", "map", "match", "matchAll", "normalize", "padEnd", "padStart", "reduce", "reduceRight", "repeat", "replace",
  "replaceAll", "search", "slice", "sort", "split", "startsWith", "substr", "substring", "toLocaleLowerCase",
  "toLocaleUpperCase", "toLowerCase", "toReversed", "toSorted", "toSpliced", "toUpperCase", "trim", "trimEnd", "trimStart",
  "values", "with",
];
const MUTATING_METHODS: readonly string[] = ["copyWithin", "fill", "pop", "push", "reverse", "shift", "splice", "unshift"];

const NAMESPACE_CALLS: ReadonlyMap<string, TestBodyForm> = new Map([
  ["JSON.stringify", JSON_CALL],
  ["JSON.parse", JSON_CALL],
  ["Object.assign", OBJECT_ASSIGN],
  ["Object.fromEntries", OBJECT_FROM_ENTRIES],
  ["Array.from", ARRAY_FROM],
]);

const SHORT_CIRCUIT_TOKENS = (request: { readonly syntaxApi: SyntaxApi }): readonly number[] => [
  request.syntaxApi.SyntaxKind.QuestionQuestionToken,
  request.syntaxApi.SyntaxKind.BarBarToken,
  request.syntaxApi.SyntaxKind.AmpersandAmpersandToken,
  request.syntaxApi.SyntaxKind.QuestionQuestionEqualsToken,
  request.syntaxApi.SyntaxKind.BarBarEqualsToken,
  request.syntaxApi.SyntaxKind.AmpersandAmpersandEqualsToken,
];

type MockRecord = "calls" | "results" | "other";

const mockRecordNamed = (request: FormRequest): MockRecord => {
  const { syntaxApi, node } = request;
  const isMockProperty = syntaxApi.isPropertyAccessExpression(node) && syntaxApi.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "mock";
  if (!isMockProperty) return "other";
  if (node.name.text === "calls") return "calls";
  return node.name.text === "results" ? "results" : "other";
};

const mockRecordReading = (request: FormRequest): MockRecord => {
  const { syntaxApi, node } = request;
  const readsLastCall = syntaxApi.isPropertyAccessExpression(node) && node.name.text === "lastCall" &&
    syntaxApi.isPropertyAccessExpression(node.expression) && node.expression.name.text === "mock";
  if (readsLastCall) return "calls";
  return syntaxApi.isElementAccessExpression(node) ? mockRecordNamed({ syntaxApi, node: node.expression }) : "other";
};

const statementForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isIfStatement(node)) return BRANCHING;
  if (syntaxApi.isTryStatement(node)) return TRY_BLOCK;
  if (syntaxApi.isSwitchStatement(node)) return SWITCH;
  const isLet = syntaxApi.isVariableStatement(node) &&
    (node.declarationList.flags & syntaxApi.NodeFlags.Let) === syntaxApi.NodeFlags.Let;
  return isLet ? LET : undefined;
};

const methodForm = (request: { readonly name: string }): TestBodyForm | undefined => {
  if (PICKING_METHODS.includes(request.name)) return PICKING_METHOD;
  if (COMPUTING_METHODS.includes(request.name)) return COMPUTING_METHOD;
  return MUTATING_METHODS.includes(request.name) ? MUTATING_METHOD : undefined;
};

const namespaceForm = (request: FormRequest & { readonly name: string }): TestBodyForm | undefined => {
  if (!request.syntaxApi.isIdentifier(request.node)) return undefined;
  if (request.node.text === "Math") return MATH_CALL;
  return NAMESPACE_CALLS.get(`${request.node.text}.${request.name}`);
};

type CallTarget = "own-api" | "built-in-or-library";

const BUILT_IN_NAMESPACES: readonly string[] = [
  "Array", "Atomics", "Buffer", "Date", "Intl", "JSON", "Map", "Math", "Number", "Object", "Promise", "Reflect", "Set", "String",
  "Symbol", "URL", "URLSearchParams", "console", "crypto", "globalThis", "performance", "process",
];

const MOST_ARGUMENTS: ReadonlyMap<string, number> = new Map([
  ...["keys", "values", "entries", "pop", "shift", "reverse", "toReversed", "trim", "trimStart", "trimEnd", "toLowerCase", "toUpperCase"]
    .map((name): [string, number] => [name, 0]),
  ...["join", "at", "charAt", "charCodeAt", "codePointAt", "flat", "sort", "toSorted", "repeat", "normalize", "toLocaleLowerCase",
    "toLocaleUpperCase", "match", "matchAll", "search"].map((name): [string, number] => [name, 1]),
  ...["split", "slice", "substring", "substr", "padStart", "padEnd", "startsWith", "endsWith", "replace", "replaceAll", "map", "filter",
    "find", "findIndex", "findLast", "findLastIndex", "every", "some", "forEach", "flatMap", "reduce", "reduceRight", "with"]
    .map((name): [string, number] => [name, 2]),
  ...["includes", "indexOf", "lastIndexOf", "copyWithin", "localeCompare"].map((name): [string, number] => [name, 3]),
  ["fill", 4],
]);

type ObjectPositions = { readonly from: number } | { readonly at: readonly number[] };

const CALLBACK_METHODS_TAKING_THIS: readonly string[] = [
  "every", "filter", "find", "findIndex", "findLast", "findLastIndex", "flatMap", "forEach", "map", "some",
];

const SYMBOL_PROTOCOL_METHODS: readonly string[] = ["match", "matchAll", "replace", "replaceAll", "search", "split"];

const OBJECT_POSITIONS: ReadonlyMap<string, ObjectPositions> = new Map<string, ObjectPositions>([
  ...CALLBACK_METHODS_TAKING_THIS.map((name): [string, ObjectPositions] => [name, { at: [1] }]),
  ...SYMBOL_PROTOCOL_METHODS.map((name): [string, ObjectPositions] => [name, { at: [0] }]),
  ["includes", { at: [0] }],
  ["indexOf", { at: [0] }],
  ["lastIndexOf", { at: [0] }],
  ["fill", { at: [0] }],
  ["reduce", { at: [1] }],
  ["reduceRight", { at: [1] }],
  ["with", { at: [1] }],
  ["localeCompare", { at: [2] }],
  ["splice", { from: 2 }],
  ["toSpliced", { from: 2 }],
  ["push", { from: 0 }],
  ["unshift", { from: 0 }],
  ["concat", { from: 0 }],
]);

const objectFitsBuiltIn = (request: { readonly name: string; readonly position: number }): "fits" | "never-fits" => {
  const positions = OBJECT_POSITIONS.get(request.name);
  if (positions === undefined) return "never-fits";
  const fits = "from" in positions ? request.position >= positions.from : positions.at.includes(request.position);
  return fits ? "fits" : "never-fits";
};

const moduleTarget = (request: { readonly specifier: string }): CallTarget =>
  request.specifier.startsWith(".") ? "own-api" : "built-in-or-library";

const loadedModuleOf = (request: FormRequest): string | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const loads = node.expression.kind === syntaxApi.SyntaxKind.ImportKeyword ||
    (syntaxApi.isIdentifier(node.expression) && node.expression.text === "require");
  const [specifier] = node.arguments;
  return loads && specifier !== undefined && syntaxApi.isStringLiteralLike(specifier) ? specifier.text : undefined;
};

const bindsName = (request: { readonly syntaxApi: SyntaxApi; readonly binding: SyntaxNode; readonly name: string }): "binds" | "other" => {
  const { syntaxApi, binding, name } = request;
  if (syntaxApi.isIdentifier(binding)) return binding.text === name ? "binds" : "other";
  if (!syntaxApi.isObjectBindingPattern(binding) && !syntaxApi.isArrayBindingPattern(binding)) return "other";
  const binds = binding.elements.some((element) =>
    syntaxApi.isBindingElement(element) && bindsName({ syntaxApi, binding: element.name, name }) === "binds");
  return binds ? "binds" : "other";
};

const declarationsNamed = (request: FormRequest & { readonly name: string }): readonly SyntaxNode[] => {
  const { syntaxApi, name } = request;
  const declarations: SyntaxNode[] = [];
  const visit = (node: SyntaxNode): void => {
    const declares = (syntaxApi.isVariableDeclaration(node) && bindsName({ syntaxApi, binding: node.name, name }) === "binds") ||
      (syntaxApi.isImportEqualsDeclaration(node) && node.name.text === name);
    if (declares) declarations.push(node);
    syntaxApi.forEachChild(node, visit);
  };
  visit(request.node.getSourceFile());
  return declarations;
};

type OriginRequest = FormRequest & { readonly visited: readonly string[] };

const declarationTarget = (request: OriginRequest): CallTarget => {
  const { syntaxApi, node, visited } = request;
  if (syntaxApi.isImportEqualsDeclaration(node)) {
    const reference = node.moduleReference;
    return syntaxApi.isExternalModuleReference(reference) && syntaxApi.isStringLiteralLike(reference.expression)
      ? moduleTarget({ specifier: reference.expression.text })
      : "own-api";
  }
  if (!syntaxApi.isVariableDeclaration(node) || node.initializer === undefined) return "own-api";
  return originTarget({ syntaxApi, node: node.initializer, visited });
};

const nameTarget = (request: OriginRequest & { readonly name: string }): CallTarget => {
  const { syntaxApi, node, name, visited } = request;
  if (visited.includes(name)) return "own-api";
  if (BUILT_IN_NAMESPACES.includes(name) || packageBindingsOf({ syntaxApi, node }).includes(name)) return "built-in-or-library";
  const fromLibrary = declarationsNamed({ syntaxApi, node, name }).some((declaration) =>
    declarationTarget({ syntaxApi, node: declaration, visited: [...visited, name] }) === "built-in-or-library");
  return fromLibrary ? "built-in-or-library" : "own-api";
};

const memberTarget = (request: OriginRequest & { readonly member: SyntaxNode }): CallTarget => {
  const { syntaxApi, member, visited } = request;
  if (syntaxApi.isShorthandPropertyAssignment(member)) {
    return nameTarget({ syntaxApi, node: member, name: member.name.text, visited });
  }
  return syntaxApi.isPropertyAssignment(member) ? originTarget({ syntaxApi, node: member.initializer, visited }) : "own-api";
};

const heldMembersNamed = (request: FormRequest & { readonly holder: string; readonly member: string }): readonly SyntaxNode[] => {
  const { syntaxApi, holder, member } = request;
  return declarationsNamed({ syntaxApi, node: request.node, name: holder }).flatMap((declaration) => {
    if (!syntaxApi.isVariableDeclaration(declaration) || !syntaxApi.isIdentifier(declaration.name)) return [];
    const { initializer } = declaration;
    if (initializer === undefined || !syntaxApi.isObjectLiteralExpression(initializer)) return [];
    return initializer.properties.filter((property) =>
      property.name !== undefined && syntaxApi.isIdentifier(property.name) && property.name.text === member);
  });
};

const heldValueTarget = (request: OriginRequest): CallTarget | undefined => {
  const { syntaxApi, node, visited } = request;
  if (!syntaxApi.isPropertyAccessExpression(node) || !syntaxApi.isIdentifier(node.expression)) return undefined;
  const members = heldMembersNamed({ syntaxApi, node, holder: node.expression.text, member: node.name.text });
  if (members.length === 0) return undefined;
  const fromLibrary = members.some((member) => memberTarget({ syntaxApi, node, member, visited }) === "built-in-or-library");
  return fromLibrary ? "built-in-or-library" : "own-api";
};

const originTarget = (request: OriginRequest): CallTarget => {
  const { syntaxApi, node, visited } = request;
  const loadedModule = loadedModuleOf({ syntaxApi, node });
  if (loadedModule !== undefined) return moduleTarget({ specifier: loadedModule });
  const held = heldValueTarget(request);
  if (held !== undefined) return held;
  if (syntaxApi.isIdentifier(node)) return nameTarget({ syntaxApi, node, name: node.text, visited });
  if (syntaxApi.isStringLiteralLike(node) || syntaxApi.isArrayLiteralExpression(node) || syntaxApi.isTemplateExpression(node)) {
    return "built-in-or-library";
  }
  const isChain = syntaxApi.isPropertyAccessExpression(node) || syntaxApi.isElementAccessExpression(node) ||
    syntaxApi.isCallExpression(node) || syntaxApi.isParenthesizedExpression(node) || syntaxApi.isNonNullExpression(node) ||
    syntaxApi.isAwaitExpression(node) || syntaxApi.isAsExpression(node) || syntaxApi.isSatisfiesExpression(node);
  return isChain ? originTarget({ syntaxApi, node: node.expression, visited }) : "own-api";
};

const packageBindingsOf = (request: FormRequest): readonly string[] =>
  request.node.getSourceFile().statements.flatMap((statement) => {
    const { syntaxApi } = request;
    if (!syntaxApi.isImportDeclaration(statement) || !syntaxApi.isStringLiteral(statement.moduleSpecifier)) return [];
    if (statement.moduleSpecifier.text.startsWith(".") || statement.importClause === undefined) return [];
    const { name, namedBindings } = statement.importClause;
    const named = namedBindings === undefined
      ? []
      : syntaxApi.isNamespaceImport(namedBindings)
        ? [namedBindings.name.text]
        : namedBindings.elements.map((element) => element.name.text);
    return name === undefined ? named : [name.text, ...named];
  });

const argumentsTarget = (request: { readonly syntaxApi: SyntaxApi; readonly call: CallExpression; readonly name: string }): CallTarget => {
  const { syntaxApi, call, name } = request;
  if (call.arguments.some((argument) => syntaxApi.isSpreadElement(argument))) return "built-in-or-library";
  const mostArguments = MOST_ARGUMENTS.get(name);
  if (mostArguments !== undefined && call.arguments.length > mostArguments) return "own-api";
  const objectNoBuiltInTakes = call.arguments.some((argument, position) =>
    syntaxApi.isObjectLiteralExpression(argument) && objectFitsBuiltIn({ name, position }) === "never-fits");
  return objectNoBuiltInTakes ? "own-api" : "built-in-or-library";
};

const callTargetOf = (request: { readonly syntaxApi: SyntaxApi; readonly call: CallExpression; readonly method: PropertyAccessExpression }): CallTarget => {
  const { syntaxApi, call, method } = request;
  if (originTarget({ syntaxApi, node: method.expression, visited: [] }) === "built-in-or-library") return "built-in-or-library";
  return argumentsTarget({ syntaxApi, call, name: method.name.text });
};

const listedMethodForm = (request: { readonly syntaxApi: SyntaxApi; readonly call: CallExpression; readonly method: PropertyAccessExpression }): TestBodyForm | undefined => {
  const form = methodForm({ name: request.method.name.text });
  if (form === undefined) return undefined;
  return callTargetOf(request) === "own-api" ? undefined : form;
};

const callForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const calledForm = syntaxApi.isPropertyAccessExpression(node.expression)
    ? listedMethodForm({ syntaxApi, call: node, method: node.expression }) ??
      namespaceForm({ syntaxApi, node: node.expression.expression, name: node.expression.name.text })
    : undefined;
  return calledForm ?? (node.questionDotToken === undefined ? undefined : OPTIONAL_CALL);
};

const optionalChainForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  const isOptionalAccess = (syntaxApi.isPropertyAccessExpression(node) || syntaxApi.isElementAccessExpression(node)) &&
    node.questionDotToken !== undefined;
  if (!isOptionalAccess) return undefined;
  const mockRecord = mockRecordReading({ syntaxApi, node: node.expression });
  if (mockRecord === "calls") return MOCK_CALL_OPTIONAL_CHAIN;
  if (mockRecord === "results") return MOCK_RESULT_OPTIONAL_CHAIN;
  return syntaxApi.isElementAccessExpression(node.expression) ? INDEXED_OPTIONAL_CHAIN : PROPERTY_OPTIONAL_CHAIN;
};

const expressionForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isConditionalExpression(node)) return TERNARY;
  if (syntaxApi.isBinaryExpression(node) && SHORT_CIRCUIT_TOKENS({ syntaxApi }).includes(node.operatorToken.kind)) {
    return SHORT_CIRCUIT;
  }
  return callForm(request) ?? optionalChainForm(request);
};

type Enclosure = "passed-on-function" | "elsewhere";

const IMPLEMENTATION_TAKERS: readonly string[] = ["mockImplementation", "mockImplementationOnce"];

const takesImplementation = (request: FormRequest): "takes" | "other" => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node) || !syntaxApi.isPropertyAccessExpression(node.expression)) return "other";
  const callee = node.expression;
  const isViFn = callee.name.text === "fn" && syntaxApi.isIdentifier(callee.expression) && callee.expression.text === "vi";
  return isViFn || IMPLEMENTATION_TAKERS.includes(callee.name.text) ? "takes" : "other";
};

const enclosingFunctionOf = (request: FormRequest): SyntaxNode | undefined => {
  if (request.syntaxApi.isSourceFile(request.node)) return undefined;
  if (request.syntaxApi.isFunctionLike(request.node)) return request.node;
  return enclosingFunctionOf({ syntaxApi: request.syntaxApi, node: request.node.parent });
};

const enclosureOf = (request: FormRequest): Enclosure => {
  const { syntaxApi } = request;
  const enclosing = enclosingFunctionOf({ syntaxApi, node: request.node.parent });
  if (enclosing === undefined) return "elsewhere";
  const holder = syntaxApi.isPropertyAssignment(enclosing.parent) ? enclosing.parent.parent : enclosing.parent;
  const passedOn = syntaxApi.isObjectLiteralExpression(holder) || takesImplementation({ syntaxApi, node: holder }) === "takes";
  return passedOn ? "passed-on-function" : "elsewhere";
};

export const testBodyFormOf = (request: FormRequest): TestBodyForm | undefined => {
  const form = statementForm(request) ?? expressionForm(request);
  if (form === undefined) return undefined;
  return enclosureOf(request) === "passed-on-function" ? { introducedIn: form.introducedIn, remedy: PASSED_ON_FUNCTION } : form;
};

const snippetAt = (request: { readonly source: string; readonly position: number }): string => {
  const snippet = request.source.slice(request.position, request.position + 80).replace(/\n/g, " ");
  return snippet.length === 80 ? `${snippet}…` : snippet;
};

export const check: WalkerPiece = {
  prepare: ({ clauses, syntaxApi }) => ({
    outcome: "ok",
    value: {
      prepareFile: ({ file }) => {
        if (testFileEligibility({ file }) === "skipped") {
          return { outcome: "ok", value: { kind: "skipped" } };
        }
        return {
          outcome: "ok",
          value: {
            kind: "syntax",
            begin: ({ sourceFile, anchorAt }) => {
              const hits: PieceHit[] = [];
              return {
                enter: ({ node }) => {
                  const form = testBodyFormOf({ syntaxApi, node });
                  if (form === undefined) return;
                  const reaching = clauses.filter((clause) => editionReaches({ edition: clause.edition, introducedIn: form.introducedIn }) === "reached");
                  if (reaching.length === 0) return;
                  const position = node.getStart(sourceFile);
                  const anchor = anchorAt({ position });
                  const snippet = snippetAt({ source: sourceFile.text, position });
                  hits.push(...reaching.map((clause) => ({ clause: clause.address, anchor, snippet, remedy: form.remedy })));
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
