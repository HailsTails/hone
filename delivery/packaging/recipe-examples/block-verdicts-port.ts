import type { CheckAddressText } from "../../../src/domain/language-layer/check-address-text.ts";
import type { Result } from "../../../src/domain/result.ts";
import type { ExampleBlock } from "./example-block.ts";

export type BlockTypeError =
  | { readonly kind: "in-a-block"; readonly block: ExampleBlock; readonly message: string }
  | { readonly kind: "outside-the-blocks"; readonly message: string };

export type TypeErrorsPort = {
  readonly read: (request: {
    readonly blocks: readonly ExampleBlock[];
  }) => readonly BlockTypeError[];
};

export type BlockFlag = {
  readonly block: ExampleBlock;
  readonly check: CheckAddressText;
  readonly lines: readonly number[];
};

export type BlockFlagsPort = {
  readonly read: (request: {
    readonly blocks: readonly ExampleBlock[];
  }) => Promise<Result<readonly BlockFlag[], string>>;
};

export type FlaggedFormsPort = {
  readonly read: (request: {
    readonly source: string;
    readonly check: CheckAddressText;
  }) => Promise<Result<readonly string[], string>>;
};
