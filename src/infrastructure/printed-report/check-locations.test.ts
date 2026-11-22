import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../node/path-port.ts";
import { checkLocationsFor } from "./check-locations.ts";

const POSIX = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

const ENTRY_URL = "file:///repo/node_modules/@hailstails/hone/src/hone.ts";

describe("checkLocationsFor", () => {
  it("gives the parsed arguments, the repository root and the install root", () => {
    expect(
      checkLocationsFor({
        arguments: ["--repo", "/repo", "--base-revision", "origin/main"],
        path: POSIX,
        fileText: { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") },
        moduleUrl: ENTRY_URL,
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        arguments: {
          repo: "/repo",
          baseRevision: "origin/main",
          reportOutput: undefined,
          forfeiture: undefined,
        },
        repoRoot: "/repo",
        installRoot: "/repo/node_modules/@hailstails/hone",
      },
    });
  });

  it("looks for disciplines.json in the repository root", () => {
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValue("present");

    checkLocationsFor({
      arguments: ["--repo", "/repo"],
      path: POSIX,
      fileText: { exists },
      moduleUrl: ENTRY_URL,
    });

    expect(exists).toHaveBeenCalledExactlyOnceWith({ path: "/repo/disciplines.json" });
  });

  it("fails as arguments-invalid when an argument is not one the check takes", () => {
    expect(
      checkLocationsFor({
        arguments: ["--repo", "/repo", "--fix"],
        path: POSIX,
        fileText: { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") },
        moduleUrl: ENTRY_URL,
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "arguments-invalid",
        detail: 'hone check has no option "--fix"; run hone check --help for its options',
      },
    });
  });

  it("fails as selection-absent when the repository holds no disciplines.json", () => {
    expect(
      checkLocationsFor({
        arguments: ["--repo", "/repo"],
        path: POSIX,
        fileText: { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent") },
        moduleUrl: ENTRY_URL,
      }),
    ).toEqual({ outcome: "failed", error: { kind: "selection-absent", repo: "/repo" } });
  });

  it("fails as install-root-unresolvable when the entry is not a file URL", () => {
    expect(
      checkLocationsFor({
        arguments: ["--repo", "/repo"],
        path: POSIX,
        fileText: { exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("present") },
        moduleUrl: "https://example.invalid/src/hone.ts",
      }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: "https://example.invalid/src/hone.ts",
        detail: "the text is not a file: URL",
      },
    });
  });
});
