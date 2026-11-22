import { assert, describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../application/ports/file-system/file-text-port.ts";
import { isAbsolutePath } from "../domain/repository/absolute-path.ts";
import type { AbsolutePath } from "../domain/repository/absolute-path-types.ts";
import { createPathPort } from "../infrastructure/node/path-port.ts";
import { versionOneRunAt } from "./version-one-runs.ts";

const absolute = (text: string): AbsolutePath => {
  assert(isAbsolutePath(text), `${text} is absolute`);
  return text;
};

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const fileTextHolding = (request: { readonly selection: "present" | "absent" }): FileTextPort => ({
  exists: vi.fn<FileTextPort["exists"]>().mockReturnValue(request.selection),
  read: vi.fn<FileTextPort["read"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

describe("versionOneRunAt", () => {
  it("runs at the repository and the install the command was started from", async () => {
    const run = vi.fn().mockResolvedValue({ outcome: "ok", value: "ran" });

    expect(await versionOneRunAt({ ports: { path: PATH, fileText: fileTextHolding({ selection: "present" }) }, moduleUrl: "file:///install/src/hone.ts", repo: "/repo", run })).toEqual({
      outcome: "ok",
      value: "ran",
    });
    expect(run).toHaveBeenCalledExactlyOnceWith({ repoRoot: absolute("/repo"), installRoot: absolute("/install") });
  });

  it("gives the selection-absent load failure and runs nothing when the folder holds no disciplines.json", async () => {
    const run = vi.fn();

    expect(await versionOneRunAt({ ports: { path: PATH, fileText: fileTextHolding({ selection: "absent" }) }, moduleUrl: "file:///install/src/hone.ts", repo: "/repo", run })).toEqual({
      outcome: "failed",
      error: { failed: "load", failure: { kind: "selection-absent", repo: "/repo" } },
    });
    expect(run).not.toHaveBeenCalled();
  });
});
