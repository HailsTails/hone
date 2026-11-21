import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { FilePresence } from "../../../domain/repository/file-presence.ts";
import { createPathPort, type PathPort } from "../../node/path-port.ts";
import { commandRunPathOf } from "./command-run-path.ts";

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/work" });

const UNRESOLVABLE: PathPort = { ...POSIX, resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }) };

const commandWith = (request: {
  readonly arguments: readonly string[];
  readonly path: PathPort;
  readonly versionOne: FilePresence;
  readonly versionTwo: FilePresence;
}) => ({
  process: { arguments: request.arguments, writeOut: vi.fn(), writeError: vi.fn(), exitWith: vi.fn() },
  path: request.path,
  fileText: {
    exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce(request.versionOne).mockReturnValueOnce(request.versionTwo),
    read: vi.fn<FileTextPort["read"]>(),
    write: vi.fn<FileTextPort["write"]>(),
  },
});

describe("commandRunPathOf", () => {
  it("is no repository when --repo is not given", () => {
    expect(commandRunPathOf({ command: commandWith({ arguments: [], path: POSIX, versionOne: "absent", versionTwo: "absent" }) })).toEqual({ kind: "no-repository" });
  });

  it("is no repository when --repo resolves to no absolute path", () => {
    expect(commandRunPathOf({ command: commandWith({ arguments: ["--repo", "src"], path: UNRESOLVABLE, versionOne: "absent", versionTwo: "absent" }) })).toEqual({ kind: "no-repository" });
  });

  it.each([
    { holding: "disciplines.json", versionOne: "present", versionTwo: "absent", chosen: "version-1" },
    { holding: "hone.config.json", versionOne: "absent", versionTwo: "present", chosen: "version-2" },
    { holding: "neither", versionOne: "absent", versionTwo: "absent", chosen: "no-settings" },
  ] as const)("is the run path the folder holding $holding takes, for the resolved repository", ({ versionOne, versionTwo, chosen }) => {
    expect(commandRunPathOf({ command: commandWith({ arguments: ["--repo", "/repo"], path: POSIX, versionOne, versionTwo }) })).toEqual({
      kind: "repository",
      repoRoot: "/repo",
      chosen: { outcome: "ok", value: chosen },
    });
  });

  it("carries the settings-in-both-versions failure for a folder holding both", () => {
    expect(commandRunPathOf({ command: commandWith({ arguments: ["--repo", "/repo"], path: POSIX, versionOne: "present", versionTwo: "present" }) })).toEqual({
      kind: "repository",
      repoRoot: "/repo",
      chosen: { outcome: "failed", error: { kind: "settings-in-both-versions", repo: "/repo" } },
    });
  });
});
