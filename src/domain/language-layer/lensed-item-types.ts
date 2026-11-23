import type { Standing } from "./authored-item-types.ts";

export type ReviewLens =
  | "clean-architecture"
  | "decomposition"
  | "di-discipline"
  | "errors-as-data"
  | "function-first"
  | "naming"
  | "test-discipline"
  | "type-soundness"
  | "zod-boundary";

export type PrincipleItem = { readonly lenses?: readonly ReviewLens[] | undefined };

export type RuleItem = {
  readonly principle: string;
  readonly standing: Standing;
  readonly namedBans?: readonly string[] | undefined;
  readonly lenses?: readonly ReviewLens[] | undefined;
};
