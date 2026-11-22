import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";
import { createPathPort } from "../../node/path-port.ts";
import { runPathOf } from "./run-path.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const REPO_ROOT = absoluteRootOf("/repo");

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const VERSION_ONE_FILE = { path: "/repo/disciplines.json" };

const VERSION_TWO_FILE = { path: "/repo/hone.config.json" };

const runPathWith = (request: { readonly versionOne: FilePresence; readonly versionTwo: FilePresence }) => {
  const exists = vi.fn<FileTextPort["exists"]>().mockReturnValueOnce(request.versionOne).mockReturnValueOnce(request.versionTwo);
  return { result: runPathOf({ fileText: { exists }, path: POSIX, repoRoot: REPO_ROOT }), asked: exists.mock.calls };
};

describe("runPathOf", () => {
  it("is the version 1 path for a folder that holds disciplines.json, having asked about disciplines.json then hone.config.json", () => {
    expect(runPathWith({ versionOne: "present", versionTwo: "absent" })).toEqual({
      result: { outcome: "ok", value: "version-1" },
      asked: [[VERSION_ONE_FILE], [VERSION_TWO_FILE]],
    });
  });

  it("is the version 2 path for a folder that holds hone.config.json, having asked about disciplines.json then hone.config.json", () => {
    expect(runPathWith({ versionOne: "absent", versionTwo: "present" })).toEqual({
      result: { outcome: "ok", value: "version-2" },
      asked: [[VERSION_ONE_FILE], [VERSION_TWO_FILE]],
    });
  });

  it("is no settings for a folder that holds neither, so every command reports the missing hone.config.json", () => {
    expect(runPathWith({ versionOne: "absent", versionTwo: "absent" })).toEqual({
      result: { outcome: "ok", value: "no-settings" },
      asked: [[VERSION_ONE_FILE], [VERSION_TWO_FILE]],
    });
  });

  it("is settings-in-both-versions for a folder that holds both", () => {
    expect(runPathWith({ versionOne: "present", versionTwo: "present" })).toEqual({
      result: { outcome: "failed", error: { kind: "settings-in-both-versions", repo: "/repo" } },
      asked: [[VERSION_ONE_FILE], [VERSION_TWO_FILE]],
    });
  });
});
