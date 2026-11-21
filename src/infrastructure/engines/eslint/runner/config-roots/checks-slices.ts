import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import { outsideNestedRepositories, packageConfigFilesOf } from "./checks-config-roots.ts";
import { directoryOf } from "./checks-paths.ts";
import { type AnsweredFile, CHECKS_DECLARATION_PATH, CHECKS_PROJECTION_PATH } from "../projection/checks-projection.ts";

export type ChecksSlice = { readonly directory: RepoPath | undefined; readonly file: RepoPath };

export type ChecksSlices = { readonly root: ChecksSlice; readonly packages: readonly ChecksSlice[] };

const ROOT_SLICE: ChecksSlice = { directory: undefined, file: CHECKS_PROJECTION_PATH };

const packageSliceOf = (request: { readonly directory: string }): ChecksSlice => ({
  directory: repoPathSchema.parse(request.directory),
  file: repoPathSchema.parse(`${request.directory}/${CHECKS_PROJECTION_PATH}`),
});

export const declarationPathOf = (request: { readonly slice: ChecksSlice }): RepoPath =>
  request.slice.directory === undefined ? CHECKS_DECLARATION_PATH : repoPathSchema.parse(`${request.slice.directory}/${CHECKS_DECLARATION_PATH}`);

export const slicesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly declared: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
  readonly nestedRepositories: readonly string[];
}): ChecksSlices => ({
  root: ROOT_SLICE,
  packages: [
    ...new Set([
      ...packageConfigFilesOf(request).map((path) => directoryOf({ path })),
      ...outsideNestedRepositories({ directories: request.declared, nestedRepositories: request.nestedRepositories }),
    ]),
  ]
    .toSorted()
    .map((directory) => packageSliceOf({ directory })),
});

export const answeredWithin = (request: { readonly answered: readonly AnsweredFile[]; readonly slice: ChecksSlice }): readonly AnsweredFile[] => {
  const { directory } = request.slice;
  if (directory === undefined) {
    return request.answered;
  }
  const prefix = `${directory}/`;
  return request.answered.flatMap((answer) => (answer.file.startsWith(prefix) ? [{ ...answer, file: repoPathSchema.parse(answer.file.slice(prefix.length)) }] : []));
};
