import { createDefaultDirectoryPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../src/infrastructure/node/file-system/file-text-port.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";

const directory = createDefaultDirectoryPort({});

const fileText = createDefaultFileTextPort({});

const GIT_FOLDER = ".git";

const FOLDER_MARK = "<folder>";

const pathsUnder = (request: { readonly folder: string; readonly prefix: string }): readonly string[] => {
  const listed = directory.list({ path: absolutePathSchema.parse(request.folder) });
  if (listed.outcome !== "ok") {
    throw new Error(`${request.folder} could not be listed: ${listed.error.detail}`);
  }
  return listed.value
    .filter(({ name }) => name !== GIT_FOLDER)
    .flatMap(({ name, kind }) => {
      const shown = `${request.prefix}${name}`;
      return kind === "directory" ? [`${shown}/`, ...pathsUnder({ folder: `${request.folder}/${name}`, prefix: `${shown}/` })] : [shown];
    });
};

export const listedPathsOf = (request: { readonly repo: string }): readonly string[] => pathsUnder({ folder: request.repo, prefix: "" }).toSorted();

const textAt = (request: { readonly repo: string; readonly shown: string }): string => {
  const read = fileText.read({ path: `${request.repo}/${request.shown}` });
  return read.outcome === "ok" ? read.value : "<unreadable>";
};

export const treeOf = (request: { readonly repo: string }): Readonly<Record<string, string>> =>
  Object.fromEntries(listedPathsOf(request).map((shown) => [shown, shown.endsWith("/") ? FOLDER_MARK : textAt({ repo: request.repo, shown })]));
