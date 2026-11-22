import { REPO_OPTION } from "./command-line.ts";

export const repoArgumentOf = (request: {
  readonly arguments: readonly string[];
}): string | undefined => {
  const option = request.arguments.indexOf(REPO_OPTION.name);
  return option === -1 ? undefined : request.arguments[option + 1];
};
