import type { Result } from "../../../domain/result.ts";

export type FileRemovalPort = {
  readonly remove: (request: {
    readonly path: string;
  }) => Result<void, { readonly kind: "unremovable"; readonly path: string; readonly detail: string }>;
};
