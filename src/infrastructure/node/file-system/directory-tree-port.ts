import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../../../application/ports/file-system/directory-removal-port.ts";
import type {
  DirectoryTreeListFailure,
  DirectoryTreePort,
  DirectoryTreeRemovalFailure,
  TreeEntry,
} from "../../../application/ports/file-system/directory-tree-port.ts";
import type { FileRemovalPort } from "../../../application/ports/file-system/file-removal-port.ts";
import { createDefaultDirectoryRemovalPort } from "./directory-removal-port.ts";
import { createDefaultDirectoryPort, createDefaultFileRemovalPort } from "./file-system-port.ts";

type TreePorts = {
  readonly directory: DirectoryPort;
  readonly fileRemoval: FileRemovalPort;
  readonly directoryRemoval: DirectoryRemovalPort;
};

type Listing = Result<readonly TreeEntry[], DirectoryTreeListFailure>;

type Removal = Result<void, DirectoryTreeRemovalFailure>;

const childOf = (request: { readonly folder: AbsolutePath; readonly name: string }): AbsolutePath =>
  absolutePathSchema.parse(`${request.folder}/${request.name}`);

const textOrder = (request: { readonly left: string; readonly right: string }): number => {
  if (request.left === request.right) {
    return 0;
  }
  return request.left < request.right ? -1 : 1;
};

const listedWithin = (request: TreePorts & { readonly folder: AbsolutePath; readonly within: string }): Listing => {
  const listed = request.directory.list({ path: request.folder });
  if (listed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "directory-tree-unreadable", path: listed.error.path, detail: listed.error.detail } };
  }
  const found = listed.value.map((entry): Listing => {
    const own: TreeEntry = { path: `${request.within}${entry.name}`, name: entry.name, kind: entry.kind };
    if (entry.kind === "file") {
      return { outcome: "ok", value: [own] };
    }
    const nested = listedWithin({ ...request, folder: childOf({ folder: request.folder, name: entry.name }), within: `${own.path}/` });
    return nested.outcome === "ok" ? { outcome: "ok", value: [own, ...nested.value] } : nested;
  });
  const failure = found.find((outcome) => outcome.outcome === "failed");
  return failure ?? { outcome: "ok", value: found.flatMap((outcome) => (outcome.outcome === "ok" ? outcome.value : [])) };
};

const removedWithin = (request: TreePorts & { readonly folder: AbsolutePath }): Removal => {
  const listed = request.directory.list({ path: request.folder });
  if (listed.outcome === "failed") {
    return { outcome: "failed", error: { kind: "directory-tree-unremovable", path: listed.error.path, detail: listed.error.detail } };
  }
  const outcomes = listed.value.map((entry): Removal => {
    const child = childOf({ folder: request.folder, name: entry.name });
    if (entry.kind === "directory") {
      return removedWithin({ ...request, folder: child });
    }
    const removed = request.fileRemoval.remove({ path: child });
    return removed.outcome === "ok"
      ? removed
      : { outcome: "failed", error: { kind: "directory-tree-unremovable", path: child, detail: removed.error.detail } };
  });
  const failure = outcomes.find((outcome) => outcome.outcome === "failed");
  if (failure !== undefined) {
    return failure;
  }
  const emptied = request.directoryRemoval.removeEmpty({ path: request.folder });
  return emptied.outcome === "ok"
    ? emptied
    : { outcome: "failed", error: { kind: "directory-tree-unremovable", path: request.folder, detail: emptied.error.detail } };
};

export const createDirectoryTreePort = (options: TreePorts): DirectoryTreePort => ({
  list: (request) => {
    const listed = listedWithin({ ...options, folder: request.path, within: "" });
    return listed.outcome === "ok"
      ? { outcome: "ok", value: listed.value.toSorted((left, right) => textOrder({ left: left.path, right: right.path })) }
      : listed;
  },
  remove: (request) => removedWithin({ ...options, folder: request.path }),
});

export const createDefaultDirectoryTreePort = (_options: Record<string, never>): DirectoryTreePort =>
  createDirectoryTreePort({
    directory: createDefaultDirectoryPort({}),
    fileRemoval: createDefaultFileRemovalPort({}),
    directoryRemoval: createDefaultDirectoryRemovalPort({}),
  });
