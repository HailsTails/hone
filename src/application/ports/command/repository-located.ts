import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";

export type RepositoryLocated = { readonly repoRoot: AbsolutePath; readonly installRoot: AbsolutePath };
