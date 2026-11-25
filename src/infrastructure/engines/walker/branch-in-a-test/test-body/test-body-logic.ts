import { editionOf } from "../../../../../domain/rule-set/edition-of.ts";
import { editionReaches } from "../../../../../domain/rule-set/edition-reach.ts";
import type { Edition } from "../../../../../domain/rule-set/edition-types.ts";
import { testFileEligibility } from "../../runner/pieces/source-scope.ts";
import { sourceSnippetAt } from "../../runner/pieces/source-snippet.ts";
import type { PieceHit, WalkerPiece } from "../../runner/pieces/walker-piece.ts";
import type {
  CallExpression,
  PropertyAccessExpression,
  SyntaxApi,
  SyntaxNode,
} from "../../runner/toolchain/typescript-parse.ts";
import { type OwnPackageNames, moduleOriginOf, ownPackageNamesOf } from "./own-modules.ts";
import type piece from "./piece.json";

type TestBodyFormName = keyof typeof piece.forms;

type Remedy = NonNullable<PieceHit["remedy"]> & { readonly form: TestBodyFormName };

export type TestBodyForm = {
  readonly introducedIn: Edition;
  readonly remedy: Remedy;
};

type FormRequest = { readonly syntaxApi: SyntaxApi; readonly node: SyntaxNode };

export type Declarations = ReadonlyMap<string, readonly SyntaxNode[]>;

type BodyRequest = FormRequest & {
  readonly declarations: Declarations;
  readonly ownPackageNames: OwnPackageNames;
};

const SECOND_EDITION: Edition = editionOf("2");

const firstEdition = (remedy: Remedy): TestBodyForm => ({ introducedIn: editionOf("1"), remedy });

const secondEdition = (remedy: Remedy): TestBodyForm => ({ introducedIn: SECOND_EDITION, remedy });

const BRANCHING = firstEdition({
  fix: "The test branches because the unit can return more than one shape. Give each outcome its own test or make the return type express the one outcome callers can rely on.",
  form: "branching-with-if",
});
const TRY_BLOCK = firstEdition({
  fix: "Catching inside the test can let it pass when no error occurs. Assert the failure the unit returns. Where an adapter's caller relies on a throw, assert the throw.",
  form: "a-try-block",
});
const TERNARY = firstEdition({
  fix: "The test chooses between values at runtime. State the expected value for each case so the assertion cannot adapt to the result.",
  form: "a-ternary",
});
const LET = firstEdition({
  fix: "A reassigned local makes the test depend on hidden state. Keep the expected values fixed and assert the interaction you need to observe.",
  form: "a-let",
});
const PICKING_METHOD = firstEdition({
  fix: "Selecting an element can discard data the caller should see. Assert the whole returned collection.",
  form: "a-method-that-picks-or-tests-an-element",
});
const COMPUTING_METHOD = firstEdition({
  fix: "Computing the expectation can repeat the mistake in the implementation. Write the expected value out.",
  form: "a-method-that-computes-a-value",
});
const MUTATING_METHOD = firstEdition({
  fix: "Mutating the expected collection obscures its final state. State the finished collection so the reader can see what should be returned.",
  form: "a-method-that-mutates",
});
const SHORT_CIRCUIT = secondEdition({
  fix: "Short-circuiting lets the test skip a case when the unit returns an optional or falsy value. Make required output explicit in the unit's type or test each outcome separately.",
  form: "a-short-circuit",
});
const INDEXED_OPTIONAL_CHAIN = secondEdition({
  fix: "Optional access hides whether the expected element exists. Assert the whole collection, or assert that the element is defined and then read it.",
  form: "an-optional-chain-after-an-index",
});
const MOCK_CALL_OPTIONAL_CHAIN = secondEdition({
  fix: "Optional access hides whether the dependency was called. Assert the expected call and its arguments.",
  form: "an-optional-chain-on-a-mock-call",
});
const MOCK_RESULT_OPTIONAL_CHAIN = secondEdition({
  fix: "Optional access hides whether the dependency returned a value. Write out what the collaborator gives back, then check what the unit returns and the call it makes.",
  form: "an-optional-chain-on-a-mock-result",
});
const PROPERTY_OPTIONAL_CHAIN = secondEdition({
  fix: "The returned object can omit a property the caller needs. Make that property required in the unit's return type or test its absence as a separate outcome.",
  form: "an-optional-chain-on-a-property",
});
const OPTIONAL_CALL = secondEdition({
  fix: "The unit's output makes the function optional, so callers cannot count on being able to call it. Make the function required in the return type or test the absent case separately.",
  form: "an-optional-call",
});
const SWITCH = secondEdition({
  fix: "The test branches on a value and can omit assertions for unexpected cases. State the expected outcome for each case separately.",
  form: "a-switch",
});
const JSON_CALL = secondEdition({
  fix: "Serializing or parsing inside the test can obscure the returned structure. Assert the object the caller needs and leave its wire format to the boundary adapter.",
  form: "serialising-or-parsing-json",
});
const OBJECT_ASSIGN = secondEdition({
  fix: "Building the expected object by mutation obscures its final shape. State the fields the caller should see and make any copied fields explicit.",
  form: "merging-objects",
});
const OBJECT_FROM_ENTRIES = secondEdition({
  fix: "Building the expected object from entries hides the shape the assertion promises. Write the whole object out.",
  form: "building-an-object-from-entries",
});
const ARRAY_FROM = secondEdition({
  fix: "Generating the expected array hides the sequence being asserted. Write the array out.",
  form: "building-an-array-from-a-length",
});
const MATH_CALL = secondEdition({
  fix: "Calculating the expected number can reproduce the implementation's error. State the expected number directly.",
  form: "a-math-call",
});
const PASSED_ON_FUNCTION: Remedy = {
  fix: "A callback with its own logic makes the test depend on a second implementation. Give the collaborator a fixed answer and assert how it was used.",
  form: "logic-inside-a-function-the-test-passes-on",
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

export const TEST_BODY_REMEDIES: readonly Remedy[] = [
  ...FORMS_IN_PAGE_ORDER.map((form) => form.remedy),
  PASSED_ON_FUNCTION,
];

export const TEST_BODY_FORMS: readonly TestBodyFormName[] = TEST_BODY_REMEDIES.map(
  (remedy) => remedy.form,
);

const PICKING_METHODS: readonly string[] = [
  "at",
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "includes",
  "indexOf",
  "lastIndexOf",
  "some",
];
const COMPUTING_METHODS: readonly string[] = [
  "charAt",
  "charCodeAt",
  "codePointAt",
  "concat",
  "endsWith",
  "entries",
  "flat",
  "flatMap",
  "forEach",
  "join",
  "keys",
  "localeCompare",
  "map",
  "match",
  "matchAll",
  "normalize",
  "padEnd",
  "padStart",
  "reduce",
  "reduceRight",
  "repeat",
  "replace",
  "replaceAll",
  "search",
  "slice",
  "sort",
  "split",
  "startsWith",
  "substr",
  "substring",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
  "toLowerCase",
  "toReversed",
  "toSorted",
  "toSpliced",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimStart",
  "values",
  "with",
];
const MUTATING_METHODS: readonly string[] = [
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "splice",
  "unshift",
];

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
  const isMockProperty =
    syntaxApi.isPropertyAccessExpression(node) &&
    syntaxApi.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "mock";
  if (!isMockProperty) return "other";
  if (node.name.text === "calls") return "calls";
  return node.name.text === "results" ? "results" : "other";
};

const mockRecordReading = (request: FormRequest): MockRecord => {
  const { syntaxApi, node } = request;
  const readsLastCall =
    syntaxApi.isPropertyAccessExpression(node) &&
    node.name.text === "lastCall" &&
    syntaxApi.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "mock";
  if (readsLastCall) return "calls";
  return syntaxApi.isElementAccessExpression(node)
    ? mockRecordNamed({ syntaxApi, node: node.expression })
    : "other";
};

const statementForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isIfStatement(node)) return BRANCHING;
  if (syntaxApi.isTryStatement(node)) return TRY_BLOCK;
  if (syntaxApi.isSwitchStatement(node)) return SWITCH;
  const isLet =
    syntaxApi.isVariableStatement(node) &&
    (node.declarationList.flags & syntaxApi.NodeFlags.Let) === syntaxApi.NodeFlags.Let;
  return isLet ? LET : undefined;
};

const methodForm = (request: { readonly name: string }): TestBodyForm | undefined => {
  if (PICKING_METHODS.includes(request.name)) return PICKING_METHOD;
  if (COMPUTING_METHODS.includes(request.name)) return COMPUTING_METHOD;
  return MUTATING_METHODS.includes(request.name) ? MUTATING_METHOD : undefined;
};

const namespaceForm = (
  request: FormRequest & { readonly name: string },
): TestBodyForm | undefined => {
  if (!request.syntaxApi.isIdentifier(request.node)) return undefined;
  if (request.node.text === "Math") return MATH_CALL;
  return NAMESPACE_CALLS.get(`${request.node.text}.${request.name}`);
};

type CallTarget = "own-api" | "built-in-or-library";

const BUILT_IN_NAMESPACES: readonly string[] = [
  "Array",
  "Atomics",
  "Buffer",
  "Date",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Reflect",
  "Set",
  "String",
  "Symbol",
  "URL",
  "URLSearchParams",
  "console",
  "crypto",
  "globalThis",
  "performance",
  "process",
];

const MOST_ARGUMENTS: ReadonlyMap<string, number> = new Map([
  ...[
    "keys",
    "values",
    "entries",
    "pop",
    "shift",
    "reverse",
    "toReversed",
    "trim",
    "trimStart",
    "trimEnd",
    "toLowerCase",
    "toUpperCase",
  ].map((name): [string, number] => [name, 0]),
  ...[
    "join",
    "at",
    "charAt",
    "charCodeAt",
    "codePointAt",
    "flat",
    "sort",
    "toSorted",
    "repeat",
    "normalize",
    "toLocaleLowerCase",
    "toLocaleUpperCase",
    "match",
    "matchAll",
    "search",
  ].map((name): [string, number] => [name, 1]),
  ...[
    "split",
    "slice",
    "substring",
    "substr",
    "padStart",
    "padEnd",
    "startsWith",
    "endsWith",
    "replace",
    "replaceAll",
    "map",
    "filter",
    "find",
    "findIndex",
    "findLast",
    "findLastIndex",
    "every",
    "some",
    "forEach",
    "flatMap",
    "reduce",
    "reduceRight",
    "with",
  ].map((name): [string, number] => [name, 2]),
  ...["includes", "indexOf", "lastIndexOf", "copyWithin", "localeCompare"].map(
    (name): [string, number] => [name, 3],
  ),
  ["fill", 4],
]);

type ObjectPositions = { readonly from: number } | { readonly at: readonly number[] };

const CALLBACK_METHODS_TAKING_THIS: readonly string[] = [
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "some",
];

const SYMBOL_PROTOCOL_METHODS: readonly string[] = [
  "match",
  "matchAll",
  "replace",
  "replaceAll",
  "search",
  "split",
];

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

const objectFitsBuiltIn = (request: {
  readonly name: string;
  readonly position: number;
}): "fits" | "never-fits" => {
  const positions = OBJECT_POSITIONS.get(request.name);
  if (positions === undefined) return "never-fits";
  const fits =
    "from" in positions
      ? request.position >= positions.from
      : positions.at.includes(request.position);
  return fits ? "fits" : "never-fits";
};

const moduleTarget = (request: {
  readonly specifier: string;
  readonly ownPackageNames: OwnPackageNames;
}): CallTarget => (moduleOriginOf(request) === "own" ? "own-api" : "built-in-or-library");

const loadedModuleOf = (request: FormRequest): string | undefined => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const loads =
    node.expression.kind === syntaxApi.SyntaxKind.ImportKeyword ||
    (syntaxApi.isIdentifier(node.expression) && node.expression.text === "require");
  const [specifier] = node.arguments;
  return loads && specifier !== undefined && syntaxApi.isStringLiteralLike(specifier)
    ? specifier.text
    : undefined;
};

const boundNames = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly binding: SyntaxNode;
}): readonly string[] => {
  const { syntaxApi, binding } = request;
  if (syntaxApi.isIdentifier(binding)) return [binding.text];
  if (!syntaxApi.isObjectBindingPattern(binding) && !syntaxApi.isArrayBindingPattern(binding))
    return [];
  return binding.elements.flatMap((element) =>
    syntaxApi.isBindingElement(element) ? boundNames({ syntaxApi, binding: element.name }) : [],
  );
};

const declaredNames = (request: FormRequest): readonly string[] => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isVariableDeclaration(node))
    return [...new Set(boundNames({ syntaxApi, binding: node.name }))];
  return syntaxApi.isImportEqualsDeclaration(node) ? [node.name.text] : [];
};

export const declarationsOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly sourceFile: SyntaxNode;
}): Declarations => {
  const { syntaxApi } = request;
  const declared: { readonly name: string; readonly node: SyntaxNode }[] = [];
  const visit = (node: SyntaxNode): void => {
    declared.push(...declaredNames({ syntaxApi, node }).map((name) => ({ name, node })));
    syntaxApi.forEachChild(node, visit);
  };
  visit(request.sourceFile);
  return new Map(
    [...Map.groupBy(declared, ({ name }) => name)].map(([name, entries]) => [
      name,
      entries.map(({ node }) => node),
    ]),
  );
};

const declarationsNamed = (request: {
  readonly declarations: Declarations;
  readonly name: string;
}): readonly SyntaxNode[] => request.declarations.get(request.name) ?? [];

type OriginRequest = BodyRequest & { readonly visited: readonly string[] };

const declarationTarget = (request: OriginRequest): CallTarget => {
  const { syntaxApi, declarations, ownPackageNames, node, visited } = request;
  if (syntaxApi.isImportEqualsDeclaration(node)) {
    const reference = node.moduleReference;
    return syntaxApi.isExternalModuleReference(reference) &&
      syntaxApi.isStringLiteralLike(reference.expression)
      ? moduleTarget({ specifier: reference.expression.text, ownPackageNames })
      : "own-api";
  }
  if (!syntaxApi.isVariableDeclaration(node) || node.initializer === undefined) return "own-api";
  return originTarget({
    syntaxApi,
    declarations,
    ownPackageNames,
    node: node.initializer,
    visited,
  });
};

const nameTarget = (request: OriginRequest & { readonly name: string }): CallTarget => {
  const { syntaxApi, declarations, ownPackageNames, node, name, visited } = request;
  if (visited.includes(name)) return "own-api";
  if (
    BUILT_IN_NAMESPACES.includes(name) ||
    packageBindingsOf({ syntaxApi, ownPackageNames, node }).includes(name)
  )
    return "built-in-or-library";
  const fromLibrary = declarationsNamed({ declarations, name }).some(
    (declaration) =>
      declarationTarget({
        syntaxApi,
        declarations,
        ownPackageNames,
        node: declaration,
        visited: [...visited, name],
      }) === "built-in-or-library",
  );
  return fromLibrary ? "built-in-or-library" : "own-api";
};

const memberTarget = (request: OriginRequest & { readonly member: SyntaxNode }): CallTarget => {
  const { syntaxApi, declarations, ownPackageNames, member, visited } = request;
  if (syntaxApi.isShorthandPropertyAssignment(member)) {
    return nameTarget({
      syntaxApi,
      declarations,
      ownPackageNames,
      node: member,
      name: member.name.text,
      visited,
    });
  }
  return syntaxApi.isPropertyAssignment(member)
    ? originTarget({ syntaxApi, declarations, ownPackageNames, node: member.initializer, visited })
    : "own-api";
};

const heldMembersNamed = (
  request: FormRequest & {
    readonly declarations: Declarations;
    readonly holder: string;
    readonly member: string;
  },
): readonly SyntaxNode[] => {
  const { syntaxApi, declarations, holder, member } = request;
  return declarationsNamed({ declarations, name: holder }).flatMap((declaration) => {
    if (!syntaxApi.isVariableDeclaration(declaration) || !syntaxApi.isIdentifier(declaration.name))
      return [];
    const { initializer } = declaration;
    if (initializer === undefined || !syntaxApi.isObjectLiteralExpression(initializer)) return [];
    return initializer.properties.filter(
      (property) =>
        property.name !== undefined &&
        syntaxApi.isIdentifier(property.name) &&
        property.name.text === member,
    );
  });
};

const heldValueTarget = (request: OriginRequest): CallTarget | undefined => {
  const { syntaxApi, declarations, ownPackageNames, node, visited } = request;
  if (!syntaxApi.isPropertyAccessExpression(node) || !syntaxApi.isIdentifier(node.expression))
    return undefined;
  const members = heldMembersNamed({
    syntaxApi,
    declarations,
    node,
    holder: node.expression.text,
    member: node.name.text,
  });
  if (members.length === 0) return undefined;
  const fromLibrary = members.some(
    (member) =>
      memberTarget({ syntaxApi, declarations, ownPackageNames, node, member, visited }) ===
      "built-in-or-library",
  );
  return fromLibrary ? "built-in-or-library" : "own-api";
};

const originTarget = (request: OriginRequest): CallTarget => {
  const { syntaxApi, declarations, ownPackageNames, node, visited } = request;
  const loadedModule = loadedModuleOf({ syntaxApi, node });
  if (loadedModule !== undefined) return moduleTarget({ specifier: loadedModule, ownPackageNames });
  const held = heldValueTarget(request);
  if (held !== undefined) return held;
  if (syntaxApi.isIdentifier(node))
    return nameTarget({ syntaxApi, declarations, ownPackageNames, node, name: node.text, visited });
  if (
    syntaxApi.isStringLiteralLike(node) ||
    syntaxApi.isArrayLiteralExpression(node) ||
    syntaxApi.isTemplateExpression(node)
  ) {
    return "built-in-or-library";
  }
  const isChain =
    syntaxApi.isPropertyAccessExpression(node) ||
    syntaxApi.isElementAccessExpression(node) ||
    syntaxApi.isCallExpression(node) ||
    syntaxApi.isParenthesizedExpression(node) ||
    syntaxApi.isNonNullExpression(node) ||
    syntaxApi.isAwaitExpression(node) ||
    syntaxApi.isAsExpression(node) ||
    syntaxApi.isSatisfiesExpression(node);
  return isChain
    ? originTarget({ syntaxApi, declarations, ownPackageNames, node: node.expression, visited })
    : "own-api";
};

const packageBindingsOf = (
  request: FormRequest & { readonly ownPackageNames: OwnPackageNames },
): readonly string[] =>
  request.node.getSourceFile().statements.flatMap((statement) => {
    const { syntaxApi } = request;
    if (
      !syntaxApi.isImportDeclaration(statement) ||
      !syntaxApi.isStringLiteral(statement.moduleSpecifier)
    )
      return [];
    if (
      moduleTarget({
        specifier: statement.moduleSpecifier.text,
        ownPackageNames: request.ownPackageNames,
      }) === "own-api" ||
      statement.importClause === undefined
    )
      return [];
    const { name, namedBindings } = statement.importClause;
    const named =
      namedBindings === undefined
        ? []
        : syntaxApi.isNamespaceImport(namedBindings)
          ? [namedBindings.name.text]
          : namedBindings.elements.map((element) => element.name.text);
    return name === undefined ? named : [name.text, ...named];
  });

const argumentsTarget = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly call: CallExpression;
  readonly name: string;
}): CallTarget => {
  const { syntaxApi, call, name } = request;
  if (call.arguments.some((argument) => syntaxApi.isSpreadElement(argument)))
    return "built-in-or-library";
  const mostArguments = MOST_ARGUMENTS.get(name);
  if (mostArguments !== undefined && call.arguments.length > mostArguments) return "own-api";
  const objectNoBuiltInTakes = call.arguments.some(
    (argument, position) =>
      syntaxApi.isObjectLiteralExpression(argument) &&
      objectFitsBuiltIn({ name, position }) === "never-fits",
  );
  return objectNoBuiltInTakes ? "own-api" : "built-in-or-library";
};

const callTargetOf = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly declarations: Declarations;
  readonly ownPackageNames: OwnPackageNames;
  readonly call: CallExpression;
  readonly method: PropertyAccessExpression;
}): CallTarget => {
  const { syntaxApi, declarations, ownPackageNames, call, method } = request;
  const target = originTarget({
    syntaxApi,
    declarations,
    ownPackageNames,
    node: method.expression,
    visited: [],
  });
  if (target === "built-in-or-library") return "built-in-or-library";
  return argumentsTarget({ syntaxApi, call, name: method.name.text });
};

const listedMethodForm = (request: {
  readonly syntaxApi: SyntaxApi;
  readonly declarations: Declarations;
  readonly ownPackageNames: OwnPackageNames;
  readonly call: CallExpression;
  readonly method: PropertyAccessExpression;
}): TestBodyForm | undefined => {
  const form = methodForm({ name: request.method.name.text });
  if (form === undefined) return undefined;
  return callTargetOf(request) === "own-api" ? undefined : form;
};

const callForm = (request: BodyRequest): TestBodyForm | undefined => {
  const { syntaxApi, declarations, ownPackageNames, node } = request;
  if (!syntaxApi.isCallExpression(node)) return undefined;
  const calledForm = syntaxApi.isPropertyAccessExpression(node.expression)
    ? (listedMethodForm({
        syntaxApi,
        declarations,
        ownPackageNames,
        call: node,
        method: node.expression,
      }) ??
      namespaceForm({
        syntaxApi,
        node: node.expression.expression,
        name: node.expression.name.text,
      }))
    : undefined;
  return calledForm ?? (node.questionDotToken === undefined ? undefined : OPTIONAL_CALL);
};

const optionalChainForm = (request: FormRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  const isOptionalAccess =
    (syntaxApi.isPropertyAccessExpression(node) || syntaxApi.isElementAccessExpression(node)) &&
    node.questionDotToken !== undefined;
  if (!isOptionalAccess) return undefined;
  const mockRecord = mockRecordReading({ syntaxApi, node: node.expression });
  if (mockRecord === "calls") return MOCK_CALL_OPTIONAL_CHAIN;
  if (mockRecord === "results") return MOCK_RESULT_OPTIONAL_CHAIN;
  return syntaxApi.isElementAccessExpression(node.expression)
    ? INDEXED_OPTIONAL_CHAIN
    : PROPERTY_OPTIONAL_CHAIN;
};

const expressionForm = (request: BodyRequest): TestBodyForm | undefined => {
  const { syntaxApi, node } = request;
  if (syntaxApi.isConditionalExpression(node)) return TERNARY;
  if (
    syntaxApi.isBinaryExpression(node) &&
    SHORT_CIRCUIT_TOKENS({ syntaxApi }).includes(node.operatorToken.kind)
  ) {
    return SHORT_CIRCUIT;
  }
  return callForm(request) ?? optionalChainForm(request);
};

type Enclosure = "passed-on-function" | "elsewhere";

const IMPLEMENTATION_TAKERS: readonly string[] = ["mockImplementation", "mockImplementationOnce"];
const TEST_REGISTRATION: ReadonlySet<string> = new Set([
  "it",
  "test",
  "describe",
  "suite",
  "beforeAll",
  "beforeEach",
  "afterEach",
  "afterAll",
]);

const takesImplementation = (request: FormRequest): "takes" | "other" => {
  const { syntaxApi, node } = request;
  if (!syntaxApi.isCallExpression(node)) return "other";
  const callee = node.expression;
  if (!syntaxApi.isPropertyAccessExpression(callee)) return "other";
  const isViFn =
    callee.name.text === "fn" &&
    syntaxApi.isIdentifier(callee.expression) &&
    callee.expression.text === "vi";
  return isViFn || IMPLEMENTATION_TAKERS.includes(callee.name.text) ? "takes" : "other";
};

const enclosingFunctionOf = (request: FormRequest): SyntaxNode | undefined => {
  if (request.syntaxApi.isSourceFile(request.node)) return undefined;
  if (request.syntaxApi.isFunctionLike(request.node)) return request.node;
  return enclosingFunctionOf({ syntaxApi: request.syntaxApi, node: request.node.parent });
};

const findDirectCallbackEnclosure = (request: FormRequest): Enclosure => {
  const { syntaxApi, node } = request;
  if (
    !syntaxApi.isCallExpression(node) ||
    !syntaxApi.isIdentifier(node.expression) ||
    TEST_REGISTRATION.has(node.expression.text)
  ) {
    return "elsewhere";
  }
  const enclosing = enclosingFunctionOf({ syntaxApi, node: node.parent });
  if (enclosing === undefined) return "passed-on-function";
  const registration = enclosing.parent;
  return syntaxApi.isCallExpression(registration) &&
    syntaxApi.isIdentifier(registration.expression) &&
    TEST_REGISTRATION.has(registration.expression.text)
    ? "passed-on-function"
    : "elsewhere";
};

const enclosureOf = (request: FormRequest): Enclosure => {
  const { syntaxApi } = request;
  const enclosing = enclosingFunctionOf({ syntaxApi, node: request.node.parent });
  if (enclosing === undefined) return "elsewhere";
  const holder = syntaxApi.isPropertyAssignment(enclosing.parent)
    ? enclosing.parent.parent
    : enclosing.parent;
  const passedOn =
    syntaxApi.isObjectLiteralExpression(holder) ||
    takesImplementation({ syntaxApi, node: holder }) === "takes" ||
    findDirectCallbackEnclosure({ syntaxApi, node: holder }) === "passed-on-function";
  return passedOn ? "passed-on-function" : "elsewhere";
};

export const testBodyFormOf = (request: BodyRequest): TestBodyForm | undefined => {
  const form = statementForm(request) ?? expressionForm(request);
  if (form === undefined) return undefined;
  return enclosureOf(request) === "passed-on-function"
    ? { introducedIn: form.introducedIn, remedy: PASSED_ON_FUNCTION }
    : form;
};

export const check: WalkerPiece = {
  prepare: ({ bindings, repository, syntaxApi }) => {
    const ownPackageNames = ownPackageNamesOf({ repository });
    return {
      outcome: "ok",
      value: {
        prepareFile: ({ file }) => {
          if (testFileEligibility({ file, testFiles: repository.testFiles }) === "skipped") {
            return { outcome: "ok", value: { kind: "skipped" } };
          }
          return {
            outcome: "ok",
            value: {
              kind: "syntax",
              begin: ({ sourceFile, anchorAt }) => {
                const hits: PieceHit[] = [];
                const declarations = declarationsOf({ syntaxApi, sourceFile });
                return {
                  enter: ({ node }) => {
                    const form = testBodyFormOf({
                      syntaxApi,
                      declarations,
                      ownPackageNames,
                      node,
                    });
                    if (form === undefined) return;
                    const binding = bindings.find(
                      ({ address, forms, edition }) =>
                        forms?.[form.remedy.form] === address &&
                        editionReaches({ edition, introducedIn: form.introducedIn }) === "reached",
                    );
                    if (binding === undefined) return;
                    const position = node.getStart(sourceFile);
                    const anchor = anchorAt({ position });
                    const snippet = sourceSnippetAt({ source: sourceFile.text, position });
                    hits.push({ check: binding.address, anchor, snippet, remedy: form.remedy });
                  },
                  finish: () => hits,
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
