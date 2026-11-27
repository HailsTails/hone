import type {
  NamingOptions,
  StaticMembersOptions,
} from "../../../../domain/rule-set/check-options.ts";
import type { JsonValue } from "../../../../domain/settings/json-values/json-value.ts";

const namingExceptions: Readonly<Record<NamingOptions["exceptions"][number], JsonValue>> = {
  "quoted-members": {
    selector: [
      "objectLiteralProperty",
      "objectLiteralMethod",
      "typeProperty",
      "typeMethod",
      "classProperty",
      "classMethod",
      "accessor",
      "enumMember",
    ],
    modifiers: ["requiresQuotes"],
    format: null,
  },
  "underscore-prefixed-unused": {
    selector: ["variable", "function", "parameter"],
    modifiers: ["unused"],
    format: null,
    filter: { regex: "^_", match: true },
  },
  destructuring: { selector: ["variable", "parameter"], modifiers: ["destructured"], format: null },
  imports: { selector: "import", format: null },
  overrides: {
    selector: ["classProperty", "classMethod", "accessor", "parameterProperty"],
    modifiers: ["override"],
    format: null,
  },
};

const namingPattern = (request: {
  readonly selector: string | string[];
  readonly regex: string;
  readonly modifiers?: string[];
}) => ({
  selector: request.selector,
  ...(request.modifiers === undefined ? {} : { modifiers: request.modifiers }),
  format: null,
  custom: { regex: request.regex, match: true },
});

export const typescriptEslintNamingOptions = (options: NamingOptions): readonly JsonValue[] => {
  const { patterns } = options;
  return [
    ...options.exceptions.map((exception) => namingExceptions[exception]),
    namingPattern({ selector: "variable", regex: patterns.constant, modifiers: ["const"] }),
    namingPattern({ selector: "variable", regex: patterns.variable }),
    namingPattern({ selector: "function", regex: patterns.function }),
    namingPattern({ selector: "function", regex: patterns.globalFunction, modifiers: ["global"] }),
    namingPattern({ selector: "parameter", regex: patterns.parameter }),
    namingPattern({ selector: "typeLike", regex: patterns.type }),
    namingPattern({ selector: "enumMember", regex: patterns.enumMember }),
    namingPattern({
      selector: ["classProperty", "classMethod", "accessor", "parameterProperty"],
      regex: patterns.classMember,
    }),
    namingPattern({
      selector: ["classProperty", "accessor"],
      regex: patterns.staticMember,
      modifiers: ["static"],
    }),
    namingPattern({ selector: "objectLiteralProperty", regex: patterns.objectProperty }),
    namingPattern({ selector: "objectLiteralMethod", regex: patterns.objectMethod }),
    namingPattern({ selector: "typeProperty", regex: patterns.typeProperty }),
    namingPattern({ selector: "typeMethod", regex: patterns.typeMethod }),
    namingPattern({ selector: "import", regex: patterns.defaultImport, modifiers: ["default"] }),
    namingPattern({
      selector: "import",
      regex: patterns.namespaceImport,
      modifiers: ["namespace"],
    }),
  ];
};

export const typescriptEslintClassOptions = (
  options: StaticMembersOptions,
): readonly JsonValue[] => [
  {
    allowConstructorOnly: options.allowedClassKinds.includes("constructor-only"),
    allowEmpty: options.allowedClassKinds.includes("empty"),
    allowStaticOnly: false,
    allowWithDecorator: options.allowedClassKinds.includes("has-decorator"),
  },
];
