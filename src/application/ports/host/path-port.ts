import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";

export type RelativeLocation =
  | { readonly relation: "within-root"; readonly path: string }
  | { readonly relation: "different-root" };

export type UnresolvablePath = {
  readonly kind: "working-directory-unusable";
  readonly path: string;
};

export type PathPort = {
  readonly join: (request: { readonly segments: readonly string[] }) => string;
  readonly joinRepository: (request: { readonly segments: readonly string[] }) => string;
  readonly relative: (request: { readonly from: string; readonly to: string }) => RelativeLocation;
  readonly directoryOf: (request: { readonly path: string }) => string;
  readonly repositoryDirectoryOf: (request: { readonly path: string }) => string;
  readonly resolve: (request: { readonly path: string }) => Result<AbsolutePath, UnresolvablePath>;
  readonly fromFileUrl: (request: { readonly url: string }) => Result<
    AbsolutePath,
    {
      readonly kind: "not-a-file-url";
      readonly url: string;
      readonly detail: string;
    }
  >;
};
