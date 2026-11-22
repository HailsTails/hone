import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { DirectoryEntry } from "./directory-port.ts";

export type TreeEntry = DirectoryEntry & {
  readonly path: string;
};

export type DirectoryTreeListFailure = {
  readonly kind: "directory-tree-unreadable";
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type DirectoryTreeRemovalFailure = {
  readonly kind: "directory-tree-unremovable";
  readonly path: AbsolutePath;
  readonly detail: string;
};

export type DirectoryTreePort = {
  readonly list: (request: { readonly path: AbsolutePath }) => Result<readonly TreeEntry[], DirectoryTreeListFailure>;
  readonly remove: (request: { readonly path: AbsolutePath }) => Result<void, DirectoryTreeRemovalFailure>;
};
