import type { Result } from "../../../domain/result.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";

export type FileTextPort = {
  readonly read: (request: {
    readonly path: string;
  }) => Result<
    string,
    {
      readonly kind: "unreadable";
      readonly path: string;
      readonly detail: string;
    }
  >;
  readonly exists: (request: { readonly path: string }) => FilePresence;
  readonly write: (request: {
    readonly path: string;
    readonly text: string;
  }) => Result<
    void,
    {
      readonly kind: "unwritable";
      readonly path: string;
      readonly detail: string;
    }
  >;
};
