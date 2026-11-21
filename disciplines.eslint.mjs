import piece0 from "./src/infrastructure/engines/eslint/CD-14/cd14/cd14.eslint-plugin.ts";
import piece1 from "./src/infrastructure/engines/eslint/CD-1/cd1/cd1.eslint-plugin.ts";
import piece2 from "./src/infrastructure/engines/eslint/CD-10/cd10/cd10.eslint-plugin.ts";
import piece3 from "./src/infrastructure/engines/eslint/CD-2/cd2/cd2.eslint-plugin.ts";
import piece4 from "./src/infrastructure/engines/eslint/CD-27/cd27/cd27.eslint-plugin.ts";
import piece5 from "./src/infrastructure/engines/eslint/CD-40/cd40/cd40.eslint-plugin.ts";
import piece6 from "./src/infrastructure/engines/eslint/CD-41/cd41/cd41.eslint-plugin.ts";
import piece7 from "./src/infrastructure/engines/eslint/CD-42/cd42/cd42.eslint-plugin.ts";
import piece8 from "./src/infrastructure/engines/eslint/CD-44/cd44/cd44.eslint-plugin.ts";
import piece9 from "./src/infrastructure/engines/eslint/CD-6/cd6/cd6.eslint-plugin.ts";
import piece10 from "./src/infrastructure/engines/eslint/CD-7/cd7/cd7.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },
  },
  {
    name: "hone-core/piece/hone-cd1",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd1": piece1 },
    rules: { "hone-cd1/implicit-any-let": "error", "hone-cd1/no-explicit-any": "error" },
  },
  {
    name: "hone-core/piece/hone-cd10",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd10": piece2 },
    rules: { "hone-cd10/throw-only-error": "error" },
  },
  {
    name: "hone-core/piece/hone-cd2",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd2": piece3 },
    rules: { "hone-cd2/no-restricted-syntax": ["error",{"selector":"TSNonNullExpression","message":"CD-2: a non-null assertion claims a value the compiler cannot see; narrow it with a check instead."},{"selector":"[definite=true]","message":"CD-2: a definite assignment assertion claims an assignment the compiler cannot see; initialise the binding instead."}] },
  },
  {
    name: "hone-core/piece/hone-cd27",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd27": piece4 },
    rules: { "hone-cd27/focused-tests": "error", "hone-cd27/skipped-tests": "error" },
  },
  {
    name: "hone-core/piece/hone-cd40",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd40": piece5 },
    rules: { "hone-cd40/max-params": ["error",{"max":2,"countVoidThis":true}] },
  },
  {
    name: "hone-core/piece/hone-cd41",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd41": piece6 },
    rules: { "hone-cd41/cognitive-complexity": "error", "hone-cd41/function-length": "error" },
  },
  {
    name: "hone-core/piece/hone-cd42",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd42": piece7 },
    rules: { "hone-cd42/useless-else": "error" },
  },
  {
    name: "hone-core/piece/hone-cd44",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd44": piece8 },
    rules: { "hone-cd44/no-param-reassign": ["error",{"props":false}] },
  },
  {
    name: "hone-core/piece/hone-cd6",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd6": piece9 },
    rules: { "hone-cd6/naming-convention": ["error",{"selector":["objectLiteralProperty","objectLiteralMethod","typeProperty","typeMethod","classProperty","classMethod","accessor","enumMember"],"modifiers":["requiresQuotes"],"format":null},{"selector":["variable","function","parameter"],"modifiers":["unused"],"format":null,"filter":{"regex":"^_","match":true}},{"selector":["variable","parameter"],"modifiers":["destructured"],"format":null},{"selector":"import","format":null},{"selector":["classProperty","classMethod","accessor","parameterProperty"],"modifiers":["override"],"format":null},{"selector":"variable","modifiers":["const"],"format":null,"custom":{"regex":"^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$","match":true}},{"selector":"variable","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"function","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"function","modifiers":["global"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*)?[_$]*$","match":true}},{"selector":"parameter","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"typeLike","format":null,"custom":{"regex":"^[_$]*(?:[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}},{"selector":"enumMember","format":null,"custom":{"regex":"^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$","match":true}},{"selector":["classProperty","classMethod","accessor","parameterProperty"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$","match":true}},{"selector":["classProperty","accessor"],"modifiers":["static"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$","match":true}},{"selector":"objectLiteralProperty","format":null,"custom":{"regex":"^(?:[a-z0-9][A-Za-z0-9]*)$","match":true}},{"selector":"objectLiteralMethod","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$","match":true}},{"selector":"typeProperty","format":null,"custom":{"regex":"^(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$","match":true}},{"selector":"typeMethod","format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$","match":true}},{"selector":"import","modifiers":["default"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$","match":true}},{"selector":"import","modifiers":["namespace"],"format":null,"custom":{"regex":"^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$","match":true}}] },
  },
  {
    name: "hone-core/piece/hone-cd7",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone-cd7": piece10 },
    rules: { "hone-cd7/filename-case": "error" },
  },
  {
    name: "hone-core/file-records/CD-1#explicit-any",
    files: [
      "src/application/run/check/cd1-exempted/src/fresh.ts",
      "src/application/run/check/cd1-exempted/src/parse.ts",
    ],
    rules: { "hone-cd1/no-explicit-any": "off" },
  },
  {
    name: "hone-core/file-records/CD-41#cognitive-complexity",
    files: [
      "src/infrastructure/engines/audit/CD-43/boolean-signatures.ts",
    ],
    rules: { "hone-cd41/cognitive-complexity": "off" },
  },
  {
    name: "hone-core/file-records/CD-41#cognitive-complexity, CD-41#function-length",
    files: [
      "src/infrastructure/engines/audit/CD-6/identifier-names.ts",
    ],
    rules: { "hone-cd41/cognitive-complexity": "off", "hone-cd41/function-length": "off" },
  },
  {
    name: "hone-core/file-records/CD-41#function-length",
    files: [
      "src/infrastructure/engines/audit/runner/observe-walker-file.test.ts",
      "src/infrastructure/engines/audit/runner/prepare-walker-pieces.test.ts",
      "src/infrastructure/engines/eslint/CD-6/cd6/cd6.eslint-plugin.test.ts",
    ],
    rules: { "hone-cd41/function-length": "off" },
  },
  {
    name: "hone-core/file-records/CD-6#naming-convention",
    files: [
      "delivery/install-proof/install-proof-plan.test.ts",
      "delivery/install-proof/install-proof-ports.test.ts",
      "src/infrastructure/engines/eslint/runner/pieces/eslint-plugin-schema.test.ts",
      "src/infrastructure/engines/eslint/runner/pieces/rule-sites.ts",
      "src/infrastructure/git/git-port.test.ts",
      "src/infrastructure/node/process/execution-port.test.ts",
    ],
    rules: { "hone-cd6/naming-convention": "off" },
  },
];
