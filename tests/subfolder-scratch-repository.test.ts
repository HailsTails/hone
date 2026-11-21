import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../src/infrastructure/node/file-system/file-system-port.ts";
import { absolutePathSchema } from "../src/infrastructure/content-files/absolute-path.ts";
import type { ScratchFilesPort } from "../delivery/install-proof/install-proof-ports.ts";
import type { ScratchRepositories } from "./scratch-repositories.ts";
import { repositoryWithSubfolder } from "./subfolder-scratch-repository.ts";

const REPO = absolutePathSchema.parse("/scratch/repo");

const repositoriesMaking = (): ScratchRepositories => ({
  repositoryWith: vi.fn<ScratchRepositories["repositoryWith"]>().mockReturnValue(REPO),
  removeAll: vi.fn<ScratchRepositories["removeAll"]>(),
});

describe("repositoryWithSubfolder", () => {
  it("makes the repository with its files, then the subfolder, then writes the subfolder's files into it", () => {
    const repositories = repositoriesMaking();
    const makeDirectory = vi.fn<ScratchFilesPort["makeDirectory"]>().mockReturnValue({ outcome: "ok", value: null });
    const write = vi.fn<FileTextPort["write"]>().mockReturnValue({ outcome: "ok", value: undefined });

    const repo = repositoryWithSubfolder({
      repositories,
      scratch: { makeDirectory },
      fileText: { write },
      files: { "a.ts": "export {};\n" },
      subfolder: "sub",
      subfolderFiles: { "b.ts": "export {};\n" },
    });

    expect({ repo, made: vi.mocked(repositories.repositoryWith).mock.calls, folders: makeDirectory.mock.calls, written: write.mock.calls }).toEqual({
      repo: REPO,
      made: [[{ files: { "a.ts": "export {};\n" } }]],
      folders: [[{ path: "/scratch/repo/sub" }]],
      written: [[{ path: "/scratch/repo/sub/b.ts", text: "export {};\n" }]],
    });
  });

  it("stops naming the folder when it cannot be made", () => {
    const makeDirectory = vi.fn<ScratchFilesPort["makeDirectory"]>().mockReturnValue({ outcome: "failed", error: { kind: "effect-failed", detail: "EACCES" } });

    expect(() =>
      repositoryWithSubfolder({ repositories: repositoriesMaking(), scratch: { makeDirectory }, fileText: { write: vi.fn<FileTextPort["write"]>() }, files: {}, subfolder: "sub", subfolderFiles: {} }),
    ).toThrow("a scratch subfolder could not be made at /scratch/repo/sub: EACCES");
  });
});
