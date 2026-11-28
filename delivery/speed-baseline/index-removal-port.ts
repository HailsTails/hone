import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type IndexRemovalFailure = {
  readonly kind: "index-unremoved";
  readonly index: AbsolutePath;
  readonly detail: string;
};

export type IndexRemovalPort = {
  readonly remove: (request: { readonly index: AbsolutePath }) => Result<null, IndexRemovalFailure>;
};
