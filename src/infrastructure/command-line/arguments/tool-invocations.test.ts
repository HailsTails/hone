import { describe, expect, it } from "vitest";
import { createPathPort } from "../../node/path-port.ts";
import { projectCommandOf, pruneCommandOf } from "./tool-invocations.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";

const POSIX_PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/work/shop/packages/web" });

const INSTALLED_ENTRY = "file:///work/shop/node_modules/@hailstails/hone/src/hone.js";

describe("projectCommandOf", () => {
  it("runs the installed entry file with node by its absolute path, with the repository root the check measured", () => {
    expect(
      projectCommandOf({ path: POSIX_PATH, moduleUrl: INSTALLED_ENTRY, repoRoot: absoluteRootOf("/work/shop") }),
    ).toEqual({
      outcome: "ok",
      value: "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo /work/shop",
    });
  });

  it("quotes a path holding a space", () => {
    expect(
      projectCommandOf({ path: POSIX_PATH, moduleUrl: INSTALLED_ENTRY, repoRoot: absoluteRootOf("/work/my shop") }),
    ).toEqual({
      outcome: "ok",
      value: "node /work/shop/node_modules/@hailstails/hone/src/hone.js project --repo \"/work/my shop\"",
    });
  });

  it("writes Windows paths with forward slashes", () => {
    expect(
      projectCommandOf({
        path: createPathPort({ flavour: "windows", workingDirectory: () => "D:\\elsewhere" }),
        moduleUrl: "file:///C:/work/shop/node_modules/@hailstails/hone/src/hone.js",
        repoRoot: absoluteRootOf("C:\\work\\shop"),
      }),
    ).toEqual({
      outcome: "ok",
      value: "node C:/work/shop/node_modules/@hailstails/hone/src/hone.js project --repo C:/work/shop",
    });
  });

  it("fails as install-root-unresolvable when the module URL is not a file URL", () => {
    expect(
      projectCommandOf({
        path: POSIX_PATH,
        moduleUrl: "https://example.com/tool-command.js",
        repoRoot: absoluteRootOf("/work/shop"),
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "install-root-unresolvable", url: "https://example.com/tool-command.js" } });
  });
});

describe("pruneCommandOf", () => {
  it("runs prune-debt on the repository root with no other option when the check was given none", () => {
    expect(
      pruneCommandOf({
        path: POSIX_PATH,
        moduleUrl: INSTALLED_ENTRY,
        repoRoot: absoluteRootOf("/work/shop"),
        baseRevision: undefined,
        forfeiture: undefined,
      }),
    ).toEqual({
      outcome: "ok",
      value: "node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop",
    });
  });

  it("passes on the --base-revision and --forfeiture the check was given, quoting a revision that holds a space", () => {
    expect(
      pruneCommandOf({
        path: POSIX_PATH,
        moduleUrl: INSTALLED_ENTRY,
        repoRoot: absoluteRootOf("/work/shop"),
        baseRevision: "origin/main@{1 day ago}",
        forfeiture: "this-run",
      }),
    ).toEqual({
      outcome: "ok",
      value:
        'node /work/shop/node_modules/@hailstails/hone/src/hone.js prune-debt --repo /work/shop --base-revision "origin/main@{1 day ago}" --forfeiture this-run',
    });
  });

  it("fails as install-root-unresolvable when the module URL is not a file URL", () => {
    expect(
      pruneCommandOf({
        path: POSIX_PATH,
        moduleUrl: "https://example.com/tool-command.js",
        repoRoot: absoluteRootOf("/work/shop"),
        baseRevision: undefined,
        forfeiture: undefined,
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "install-root-unresolvable", url: "https://example.com/tool-command.js" } });
  });
});
