import type { RepoPath } from "../../../../../domain/repository/repo-path-types.ts";
import type { AnsweredFile } from "../../../../../domain/runner/checks-run-report.ts";
import type { EslintConfigLookup } from "../../../../../domain/settings/eslint-config-lookup.ts";
import { repoPathSchema } from "../../../../hone-records-folder/repo-path.ts";
import { outsideNestedRepositories, packageConfigFilesOf } from "./checks-config-roots.ts";
import { directoryOf } from "./checks-paths.ts";

export type ChecksSlice = { readonly directory: RepoPath | undefined; readonly file: RepoPath };

export type ChecksSlices = {
  readonly root: ChecksSlice;
  readonly packages: readonly ChecksSlice[];
};

export const pathInSlice = (request: {
  readonly directory: RepoPath | undefined;
  readonly name: RepoPath;
}): RepoPath =>
  request.directory === undefined
    ? request.name
    : repoPathSchema.parse(`${request.directory}/${request.name}`);

const packageSliceOf = (request: {
  readonly directory: string;
  readonly configuration: RepoPath;
}): ChecksSlice => {
  const directory = repoPathSchema.parse(request.directory);
  return { directory, file: pathInSlice({ directory, name: request.configuration }) };
};

export const declarationPathOf = (request: {
  readonly slice: ChecksSlice;
  readonly declaration: RepoPath;
}): RepoPath => pathInSlice({ directory: request.slice.directory, name: request.declaration });

export const slicesOf = (request: {
  readonly trackedPaths: readonly RepoPath[];
  readonly declared: readonly RepoPath[];
  readonly lookup: EslintConfigLookup;
  readonly nestedRepositories: readonly string[];
  readonly configuration: RepoPath;
}): ChecksSlices => ({
  root: { directory: undefined, file: request.configuration },
  packages: [
    ...new Set([
      ...packageConfigFilesOf(request).map((path) => directoryOf({ path })),
      ...outsideNestedRepositories({
        directories: request.declared,
        nestedRepositories: request.nestedRepositories,
      }),
    ]),
  ]
    .toSorted()
    .map((directory) => packageSliceOf({ directory, configuration: request.configuration })),
});

export const answeredWithin = (request: {
  readonly answered: readonly AnsweredFile[];
  readonly slice: ChecksSlice;
}): readonly AnsweredFile[] => {
  const { directory } = request.slice;
  if (directory === undefined) {
    return request.answered;
  }
  const prefix = `${directory}/`;
  return request.answered.flatMap((answer) =>
    answer.file.startsWith(prefix)
      ? [{ ...answer, file: repoPathSchema.parse(answer.file.slice(prefix.length)) }]
      : [],
  );
};
