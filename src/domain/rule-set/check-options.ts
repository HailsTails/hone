import type { CheckAddressText } from "../language-layer/check-address-text.ts";
import type { RuleSetIdentity } from "./clause-address-types.ts";
import { TOOL_RULE_SET } from "./clause-address.ts";
import { editionOf } from "./edition-of.ts";
import { editionReaches } from "./edition-reach.ts";
import type { Edition } from "./edition-types.ts";

type NamingPatterns = {
  readonly constant: string;
  readonly variable: string;
  readonly function: string;
  readonly globalFunction: string;
  readonly parameter: string;
  readonly type: string;
  readonly enumMember: string;
  readonly classMember: string;
  readonly staticMember: string;
  readonly objectProperty: string;
  readonly objectMethod: string;
  readonly typeProperty: string;
  readonly typeMethod: string;
  readonly defaultImport: string;
  readonly namespaceImport: string;
};

export type NamingOptions = {
  readonly kind: "naming-convention";
  readonly exceptions: readonly (
    | "quoted-members"
    | "underscore-prefixed-unused"
    | "destructuring"
    | "imports"
    | "overrides"
  )[];
  readonly patterns: NamingPatterns;
};

export type StaticMembersOptions = {
  readonly kind: "static-members-only";
  readonly allowedClassKinds: readonly ("empty" | "constructor-only" | "has-decorator")[];
};

type RejectedAssertion = "asserted-value" | "asserted-assignment";

export const nonNullAssertionMessage: Readonly<Record<RejectedAssertion, string>> = {
  "asserted-value":
    "A non-null assertion claims a value the compiler cannot see; narrow it with a check instead.",
  "asserted-assignment":
    "A definite assignment assertion claims an assignment the compiler cannot see; initialise the binding instead.",
};

export type HoneCheckOptions =
  | NamingOptions
  | StaticMembersOptions
  | {
      readonly kind: "parameter-count";
      readonly maximumSlots: number;
      readonly voidReceiver: "count" | "exclude";
    }
  | {
      readonly kind: "parameter-reassignment";
      readonly assignments: "binding" | "binding-and-properties";
    }
  | {
      readonly kind: "non-null-assertions";
      readonly rejects: readonly RejectedAssertion[];
    }
  | {
      readonly kind: "skipped-tests";
      readonly coverage: "skips-and-fixmes" | "including-conditional-and-todo";
    };

const fixedOptions: Readonly<Partial<Record<CheckAddressText, HoneCheckOptions>>> = {
  "positional-parameters#parameter-count": {
    kind: "parameter-count",
    maximumSlots: 2,
    voidReceiver: "count",
  },
  "rebinding#parameter-reassignment": { kind: "parameter-reassignment", assignments: "binding" },
  "authored-class-or-this#static-members-only": {
    kind: "static-members-only",
    allowedClassKinds: ["empty", "constructor-only", "has-decorator"],
  },
  "claimed-type#non-null-assertions": {
    kind: "non-null-assertions",
    rejects: ["asserted-value", "asserted-assignment"],
  },
  "name-off-its-casing#naming-convention": {
    kind: "naming-convention",
    exceptions: [
      "quoted-members",
      "underscore-prefixed-unused",
      "destructuring",
      "imports",
      "overrides",
    ],
    patterns: {
      constant:
        "^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$",
      variable:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      function:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      globalFunction:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*)?[_$]*$",
      parameter:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      type: "^[_$]*(?:[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
      enumMember: "^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$",
      classMember: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$",
      staticMember: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$",
      objectProperty: "^(?:[a-z0-9][A-Za-z0-9]*)$",
      objectMethod: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$",
      typeProperty: "^(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))$",
      typeMethod: "^[_$]*(?:[a-z0-9][A-Za-z0-9]*)?[_$]*$",
      defaultImport:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*)|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)?[_$]*$",
      namespaceImport:
        "^[_$]*(?:[a-z0-9][A-Za-z0-9]*|[A-Z](?:[A-Za-z0-9]*[a-z][A-Za-z0-9]*|[0-9]*))?[_$]*$",
    },
  },
};

export const bindHoneCheckOptions = (request: {
  readonly ruleSet: RuleSetIdentity;
  readonly address: CheckAddressText;
  readonly edition: Edition;
}): { readonly checkOptions: HoneCheckOptions } | Record<string, never> => {
  if (request.ruleSet !== TOOL_RULE_SET) return {};
  if (request.address === "test-switched-off#skipped-tests") {
    const coverage =
      editionReaches({ edition: request.edition, introducedIn: editionOf("2") }) === "reached"
        ? "including-conditional-and-todo"
        : "skips-and-fixmes";
    return { checkOptions: { kind: "skipped-tests", coverage } };
  }
  const checkOptions = fixedOptions[request.address];
  return checkOptions === undefined ? {} : { checkOptions };
};
