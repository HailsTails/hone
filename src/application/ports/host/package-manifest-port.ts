import type { Result } from "../../../domain/result.ts";

export type PackageManifestUnresolved = {
  readonly kind: "package-manifest-unresolved";
  readonly detail: string;
};

export type PackageManifestPort = {
  readonly locateManifestFrom: (request: {
    readonly packageName: string;
    readonly folder: string;
  }) => Result<string, PackageManifestUnresolved>;
};
