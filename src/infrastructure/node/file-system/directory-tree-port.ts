import { readdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { failureDetailOf } from "../../../domain/failure-detail.ts";
import type { DirectoryTreePort, TreeEntry } from "../../../application/ports/file-system/directory-tree-port.ts";

export type DirectoryTreeSurface = {
  readonly list: (request: { readonly path: AbsolutePath }) => readonly TreeEntry[];
  readonly remove: (request: { readonly path: AbsolutePath }) => void;
};

const textOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

export const createDirectoryTreePort = (options: { readonly surface: DirectoryTreeSurface }): DirectoryTreePort => ({
  list: (request) => {
    try {
      const entries = options.surface.list({ path: request.path });
      return { outcome: "ok", value: entries.toSorted((left, right) => textOrder({ left: left.path, right: right.path })) };
    } catch (thrown) {
      return { outcome: "failed", error: { kind: "directory-tree-unreadable", path: request.path, detail: failureDetailOf({ thrown }) } };
    }
  },
  remove: (request) => {
    try {
      options.surface.remove({ path: request.path });
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return { outcome: "failed", error: { kind: "directory-tree-unremovable", path: request.path, detail: failureDetailOf({ thrown }) } };
    }
  },
});

const defaultDirectoryTreeSurface: DirectoryTreeSurface = {
  list: (request) =>
    readdirSync(request.path, { withFileTypes: true, recursive: true }).map((entry) => ({
      path: relative(request.path, join(entry.parentPath, entry.name)).replaceAll("\\", "/"),
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : "file",
    })),
  remove: (request) => {
    rmSync(request.path, { recursive: true });
  },
};

export const createDefaultDirectoryTreePort = (_options: Record<string, never>): DirectoryTreePort =>
  createDirectoryTreePort({ surface: defaultDirectoryTreeSurface });
