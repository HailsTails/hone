import { describe, expect, it, vi } from "vitest";

import type { DirectoryPort } from "../application/ports/file-system/directory-port.ts";
import type { DirectoryRemovalPort } from "../application/ports/file-system/directory-removal-port.ts";
import type { EntryKindPort } from "../application/ports/file-system/entry-kind-port.ts";
import type { FileCreationPort } from "../application/ports/file-system/file-creation-port.ts";
import type { FileRemovalPort } from "../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import type { GitPort, GitTreePort } from "../application/ports/git-port.ts";
import type { ModuleLoaderPort } from "../application/ports/host/module-loader-port.ts";
import type { PathPort } from "../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../domain/repository/absolute-root-of.ts";
import { installedPortsOver, type NodePorts } from "./installed-ports.ts";

const nodePorts = (): NodePorts => ({
  path: {
    join: vi.fn<PathPort["join"]>(),
    joinRepository: vi.fn<PathPort["joinRepository"]>(),
    relative: vi.fn<PathPort["relative"]>(),
    directoryOf: vi.fn<PathPort["directoryOf"]>(),
    repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
    resolve: vi.fn<PathPort["resolve"]>(),
    fromFileUrl: vi.fn<PathPort["fromFileUrl"]>(),
  },
  fileText: {
    read: vi.fn<FileTextPort["read"]>(),
    exists: vi.fn<FileTextPort["exists"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
  modules: { load: vi.fn<ModuleLoaderPort["load"]>() },
  git: {
    trackedPaths: vi.fn<GitPort["trackedPaths"]>(),
    changedSince: vi.fn<GitPort["changedSince"]>(),
    contentInBase: vi.fn<GitPort["contentInBase"]>(),
    textInBase: vi.fn<GitPort["textInBase"]>(),
    renamedSince: vi.fn<GitPort["renamedSince"]>(),
  },
  gitTree: {
    pathsAt: vi.fn<GitTreePort["pathsAt"]>().mockReturnValue({ outcome: "ok", value: [] }),
  },
  directory: { list: vi.fn<DirectoryPort["list"]>(), create: vi.fn<DirectoryPort["create"]>() },
  fileCreation: { createNew: vi.fn<FileCreationPort["createNew"]>() },
  fileRemoval: { remove: vi.fn<FileRemovalPort["remove"]>() },
  directoryRemoval: { removeEmpty: vi.fn<DirectoryRemovalPort["removeEmpty"]>() },
  entryKind: { kindOf: vi.fn<EntryKindPort["kindOf"]>() },
});

describe("installedPortsOver", () => {
  it("hands the node ports it is given on as the tool's own", () => {
    const node = nodePorts();
    const ports = installedPortsOver(node);
    expect([
      ports.path,
      ports.fileText,
      ports.modules,
      ports.git,
      ports.gitTree,
      ports.directory,
    ]).toEqual([node.path, node.fileText, node.modules, node.git, node.gitTree, node.directory]);
    expect([
      ports.fileCreation,
      ports.fileRemoval,
      ports.directoryRemoval,
      ports.entryKind,
    ]).toEqual([node.fileCreation, node.fileRemoval, node.directoryRemoval, node.entryKind]);
  });

  it("reads a repository's exceptions at a base revision through the node git tree it was given", () => {
    const node = nodePorts();
    const repoRoot = absoluteRootOf("/repo");
    const read = installedPortsOver(node)
      .exceptionRepositoryOf({ repoRoot })
      .readAt({ revision: "origin/main" });
    expect({ read, asked: vi.mocked(node.gitTree.pathsAt).mock.calls }).toEqual({
      read: { outcome: "ok", value: [] },
      asked: [[{ repoRoot: "/repo", revision: "origin/main" }]],
    });
  });
});
