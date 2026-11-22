import {
  accessSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from "node:fs";

import type {
  DirectoryEntry,
  DirectoryPort,
} from "../../../application/ports/file-system/directory-port.ts";
import type {
  EntryKind,
  EntryKindPort,
} from "../../../application/ports/file-system/entry-kind-port.ts";
import type { FileRemovalPort } from "../../../application/ports/file-system/file-removal-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import { failureDetailOf as failureDetail } from "../../../domain/failure-detail.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";

export type FileSystemSurface = {
  readonly readText: (request: { readonly path: string }) => string;
  readonly writeText: (request: { readonly path: string; readonly text: string }) => void;
  readonly access: (request: { readonly path: string }) => void;
};

const NO_SUCH_FILE_CODE = "ENOENT";

const presenceAfterAccessFailure = (request: { readonly thrown: unknown }): FilePresence =>
  request.thrown instanceof Error &&
  "code" in request.thrown &&
  request.thrown.code === NO_SUCH_FILE_CODE
    ? "absent"
    : "present";

export const createFileTextPort = (options: {
  readonly fileSystem: FileSystemSurface;
}): FileTextPort => ({
  read: (request) => {
    try {
      return { outcome: "ok", value: options.fileSystem.readText({ path: request.path }) };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "unreadable",
          path: request.path,
          detail: failureDetail({ thrown }),
        },
      };
    }
  },
  exists: (request) => {
    try {
      options.fileSystem.access({ path: request.path });
      return "present";
    } catch (thrown) {
      return presenceAfterAccessFailure({ thrown });
    }
  },
  write: (request) => {
    try {
      options.fileSystem.writeText({ path: request.path, text: request.text });
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "unwritable",
          path: request.path,
          detail: failureDetail({ thrown }),
        },
      };
    }
  },
});

export const defaultFileSystemSurface: FileSystemSurface = {
  readText: (request) => readFileSync(request.path, "utf8"),
  writeText: (request) => {
    writeFileSync(request.path, request.text);
  },
  access: (request) => {
    accessSync(request.path);
  },
};

export const createDefaultFileTextPort = (_options: Record<string, never>): FileTextPort =>
  createFileTextPort({ fileSystem: defaultFileSystemSurface });

export type FileRemovalSurface = {
  readonly removeFile: (request: { readonly path: string }) => void;
};

export const createFileRemovalPort = (options: {
  readonly fileSystem: FileRemovalSurface;
}): FileRemovalPort => ({
  remove: (request) => {
    try {
      options.fileSystem.removeFile({ path: request.path });
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: { kind: "unremovable", path: request.path, detail: failureDetail({ thrown }) },
      };
    }
  },
});

const defaultFileRemovalSurface: FileRemovalSurface = {
  removeFile: (request) => {
    rmSync(request.path);
  },
};

export const createDefaultFileRemovalPort = (_options: Record<string, never>): FileRemovalPort =>
  createFileRemovalPort({ fileSystem: defaultFileRemovalSurface });

export const removeEmptyDirectory = (request: { readonly path: AbsolutePath }): void => {
  rmdirSync(request.path);
};

export const createFileExclusively = (request: {
  readonly path: AbsolutePath;
  readonly text: string;
}): void => {
  writeFileSync(request.path, request.text, { flag: "wx" });
};

export type DirectorySurface = {
  readonly list: (request: { readonly path: AbsolutePath }) => readonly DirectoryEntry[];
  readonly create: (request: { readonly path: AbsolutePath }) => void;
};

export const createDirectoryPort = (options: {
  readonly directory: DirectorySurface;
}): DirectoryPort => ({
  list: (request) => {
    try {
      const entries = options.directory.list({ path: request.path });
      return {
        outcome: "ok",
        value: [...entries].sort((left, right) =>
          left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
        ),
      };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "directory-unreadable",
          path: request.path,
          detail: failureDetail({ thrown }),
        },
      };
    }
  },
  create: (request) => {
    try {
      options.directory.create({ path: request.path });
      return { outcome: "ok", value: undefined };
    } catch (thrown) {
      return {
        outcome: "failed",
        error: {
          kind: "directory-uncreatable",
          path: request.path,
          detail: failureDetail({ thrown }),
        },
      };
    }
  },
});

const defaultDirectorySurface: DirectorySurface = {
  list: (request) =>
    readdirSync(request.path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : "file",
    })),
  create: (request) => {
    mkdirSync(request.path, { recursive: true });
  },
};

export const createDefaultDirectoryPort = (_options: Record<string, never>): DirectoryPort =>
  createDirectoryPort({
    directory: defaultDirectorySurface,
  });

export type EntryKindSurface = {
  readonly stat: (request: { readonly path: string }) => Exclude<EntryKind, "absent"> | undefined;
};

export const createEntryKindPort = (options: {
  readonly surface: EntryKindSurface;
}): EntryKindPort => ({
  kindOf: (request) => {
    try {
      return options.surface.stat({ path: request.path }) ?? "absent";
    } catch {
      return "absent";
    }
  },
});

const defaultEntryKindSurface: EntryKindSurface = {
  stat: (request) => {
    const found = statSync(request.path, { throwIfNoEntry: false });
    if (found === undefined) {
      return undefined;
    }
    return found.isDirectory() ? "directory" : "file";
  },
};

export const createDefaultEntryKindPort = (_options: Record<string, never>): EntryKindPort =>
  createEntryKindPort({ surface: defaultEntryKindSurface });
