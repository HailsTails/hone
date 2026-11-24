import type { AbsolutePath } from "../../src/domain/repository/absolute-path-types.ts";
import type { Result } from "../../src/domain/result.ts";

export type InstalledCommandFailure =
  | { readonly kind: "installed-manifest-unread"; readonly detail: string }
  | { readonly kind: "installed-command-unnamed"; readonly manifest: string }
  | { readonly kind: "installed-command-unresolved"; readonly path: string };

export type InstalledCommandPort = {
  readonly read: (request: {
    readonly manifest: string;
  }) => Result<AbsolutePath, InstalledCommandFailure>;
};
