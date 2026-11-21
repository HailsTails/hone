import { describe, expect, it, vi } from "vitest";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import type { CommandRunPort } from "../delivery/install-proof/install-proof-ports.ts";
import type { ScratchRepositories } from "./scratch-repositories.ts";
import { trackedRepositoryWith } from "./tracked-scratch-repository.ts";

const REPO = absolutePathSchema.parse("/scratch/repo");

const repositoriesMaking = (): ScratchRepositories => ({
  repositoryWith: vi.fn<ScratchRepositories["repositoryWith"]>().mockReturnValue(REPO),
  removeAll: vi.fn<ScratchRepositories["removeAll"]>(),
});

describe("trackedRepositoryWith", () => {
  it("makes the repository with the files, then initialises git in it and adds everything", () => {
    const repositories = repositoriesMaking();
    const run = vi.fn<CommandRunPort["run"]>().mockReturnValue({ outcome: "exited", exitCode: 0, output: "" });

    const repo = trackedRepositoryWith({ repositories, commands: { run }, files: { "a.ts": "export {};\n" } });

    expect({ repo, made: vi.mocked(repositories.repositoryWith).mock.calls, ran: run.mock.calls }).toEqual({
      repo: REPO,
      made: [[{ files: { "a.ts": "export {};\n" } }]],
      ran: [
        [{ command: "git", arguments: ["init"], directory: REPO }],
        [{ command: "git", arguments: ["add", "."], directory: REPO }],
      ],
    });
  });

  it("stops with the git step named when git exits non-zero", () => {
    const run = vi.fn<CommandRunPort["run"]>().mockReturnValue({ outcome: "exited", exitCode: 128, output: "not a repository" });

    expect(() => trackedRepositoryWith({ repositories: repositoriesMaking(), commands: { run }, files: {} })).toThrow("git init failed in /scratch/repo");
  });
});
