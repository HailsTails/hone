import type { CommandRunPort } from "../delivery/install-proof/install-proof-ports.ts";
import type { ScratchRepositories } from "./scratch-repositories.ts";

const GIT_STEPS: readonly (readonly string[])[] = [["init"], ["add", "."]];

export const trackedRepositoryWith = (request: {
  readonly repositories: ScratchRepositories;
  readonly commands: CommandRunPort;
  readonly files: Readonly<Record<string, string>>;
}): string => {
  const repo = request.repositories.repositoryWith({ files: request.files });
  GIT_STEPS.forEach((gitArguments) => {
    const run = request.commands.run({ command: "git", arguments: gitArguments, directory: repo });
    if (run.outcome !== "exited" || run.exitCode !== 0) {
      throw new Error(`git ${gitArguments.join(" ")} failed in ${repo}`);
    }
  });
  return repo;
};
