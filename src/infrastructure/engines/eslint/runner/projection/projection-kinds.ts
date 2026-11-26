import type { ProjectionKind } from "../../../../../application/ports/settings/settings-file-format.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";

export const PROJECTION_KINDS: readonly [ProjectionKind, ...ProjectionKind[]] = ["mjs", "ts"];

export const DEFAULT_PROJECTION_KIND: ProjectionKind = "mjs";

export type ChecksProjectionOutputs =
  | { readonly kind: "mjs"; readonly configuration: RepoPath; readonly declaration: RepoPath }
  | { readonly kind: "ts"; readonly configuration: RepoPath };

export const createChecksProjectionOutputs = (request: {
  readonly kind: ProjectionKind;
}): ChecksProjectionOutputs => {
  switch (request.kind) {
    case "mjs":
      return {
        kind: "mjs",
        configuration: repoPathOf("hone.eslint.mjs"),
        declaration: repoPathOf("hone.eslint.d.mts"),
      };
    case "ts":
      return { kind: "ts", configuration: repoPathOf("hone.eslint.ts") };
  }
};

export const listChecksProjectionOutputs = (kind: ProjectionKind): readonly RepoPath[] => {
  const outputs = createChecksProjectionOutputs({ kind });
  return outputs.kind === "mjs"
    ? [outputs.configuration, outputs.declaration]
    : [outputs.configuration];
};
