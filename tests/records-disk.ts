import { createSelectionRepository, type SelectionRepository } from "../src/infrastructure/disciplines-file/consumer-selection.ts";
import { createExceptionRepository, type ExceptionLayoutPorts } from "../src/infrastructure/discipline-exceptions-folder/exception-layout.ts";
import type { ExceptionRepository, ExceptionRepositoryOf } from "../src/infrastructure/discipline-exceptions-folder/exception-records.ts";
import type { DirectoryEntry } from "../src/infrastructure/node/file-system/file-system-port.ts";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import type { GitPort } from "../src/infrastructure/git/git-port.ts";
import { createPathPort, type PathPort } from "../src/infrastructure/node/path-port.ts";
import { type AbsolutePath, absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import type { ModuleExtension } from "../src/infrastructure/node/modules/install-layout.ts";
import { repoPathSchema } from "../src/infrastructure/hone-records-folder/repo-path.ts";

export type RecordsDisk = {
  readonly repoRoot: AbsolutePath;
  readonly ports: ExceptionLayoutPorts;
  readonly texts: () => Readonly<Record<string, string>>;
};

const ROOT = "/repo";

const REPO_ROOT = absolutePathSchema.parse(ROOT);

const SINGLE_FILE = repoPathSchema.parse("discipline-exceptions.json");

const SPLIT_FOLDER_NAME = "discipline-exceptions";

const absoluteKey = (request: { readonly file: string }): string => `${ROOT}/${request.file}`;

const childEntryOf = (request: { readonly path: string; readonly folder: string }): DirectoryEntry => {
  const [name, ...rest] = request.path.slice(request.folder.length + 1).split("/");
  return { name, kind: rest.length === 0 ? "file" : "directory" };
};

const childrenOf = (request: { readonly paths: readonly string[]; readonly folder: string }): readonly DirectoryEntry[] => {
  const children = request.paths
    .filter((path) => path.startsWith(`${request.folder}/`))
    .map((path) => childEntryOf({ path, folder: request.folder }));
  return [...new Map(children.map((child) => [child.name, child])).values()];
};

export const recordsDisk = (request: {
  readonly working: Readonly<Record<string, string>>;
  readonly base: Readonly<Record<string, string>>;
}): RecordsDisk => {
  const files = new Map(Object.entries(request.working).map(([file, text]) => [absoluteKey({ file }), text]));
  const folders = new Set<string>();
  const occupied = (): readonly string[] => [...files.keys(), ...[...folders].map((folder) => `${folder}/`)];
  return {
    repoRoot: REPO_ROOT,
    texts: () => Object.fromEntries([...files.entries()].map(([path, text]) => [path.slice(ROOT.length + 1), text])),
    ports: {
      path: createPathPort({ flavour: "posix", workingDirectory: () => ROOT }),
      fileText: {
        read: ({ path }) => {
          const text = files.get(path);
          return text === undefined ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } } : { outcome: "ok", value: text };
        },
        exists: ({ path }) => (files.has(path) || occupied().some((candidate) => candidate.startsWith(`${path}/`)) ? "present" : "absent"),
        write: ({ path, text }) => {
          files.set(path, text);
          return { outcome: "ok", value: undefined };
        },
      },
      directory: {
        list: ({ path }) => ({ outcome: "ok", value: childrenOf({ paths: [...files.keys()], folder: path }).toSorted((left, right) => (left.name < right.name ? -1 : 1)) }),
        create: ({ path }) => {
          folders.add(path);
          return { outcome: "ok", value: undefined };
        },
      },
      fileRemoval: {
        remove: ({ path }) => {
          files.delete(path);
          return { outcome: "ok", value: undefined };
        },
      },
      git: {
        trackedPaths: () => ({ outcome: "ok", value: [] }),
        changedSince: () => ({ outcome: "ok", value: [] }),
        contentInBase: ({ file }) => ({ outcome: "ok", value: file in request.base ? "present-in-base" : "absent-from-base" }),
        textInBase: ({ file }) => {
          const text = request.base[file];
          return { outcome: "ok", value: text === undefined ? { presence: "absent-from-base" } : { presence: "present-in-base", text } };
        },
        renamedSince: () => ({ outcome: "ok", value: new Map() }),
      },
      gitTree: {
        pathsAt: () => ({ outcome: "ok", value: Object.keys(request.base).map((file) => repoPathSchema.parse(file)) }),
      },
    },
  };
};

export const singleFileRepositoryOver = (request: {
  readonly repoRoot: AbsolutePath;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
}): ExceptionRepository =>
  createExceptionRepository({
    ...request,
    fileText: {
      ...request.fileText,
      exists: (query) => (query.path.endsWith(SPLIT_FOLDER_NAME) ? "absent" : request.fileText.exists(query)),
    },
    directory: {
      list: ({ path }) => ({ outcome: "failed", error: { kind: "directory-unreadable", path, detail: "the single-file fake holds no folders" } }),
      create: ({ path }) => ({ outcome: "failed", error: { kind: "directory-uncreatable", path, detail: "the single-file fake holds no folders" } }),
    },
    fileRemoval: { remove: ({ path }) => ({ outcome: "failed", error: { kind: "unremovable", path, detail: "the single-file fake removes nothing" } }) },
    gitTree: { pathsAt: () => ({ outcome: "ok", value: [SINGLE_FILE] }) },
  });

export const singleFileRepositoriesOver = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
}): ExceptionRepositoryOf =>
  ({ repoRoot }) => singleFileRepositoryOver({ ...request, repoRoot });

type DiskRequest = {
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly moduleExtension: ModuleExtension;
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly git: GitPort;
};

export const withSingleFileRecords = <Request extends DiskRequest>(
  request: Request,
): Request & { readonly selectionRepository: SelectionRepository; readonly exceptionRepository: ExceptionRepository } => ({
  ...request,
  selectionRepository: createSelectionRepository(request),
  exceptionRepository: singleFileRepositoryOver(request),
});

export const withSingleFileRecordsOf = <Request extends { readonly fileText: FileTextPort; readonly path: PathPort; readonly git: GitPort }>(
  request: Request,
): Request & { readonly exceptionRepositoryOf: ExceptionRepositoryOf } => ({ ...request, exceptionRepositoryOf: singleFileRepositoriesOver(request) });
