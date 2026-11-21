import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import { createPathPort } from "../../node/path-port.ts";
import { installedVersionOf } from "./installed-version.ts";

const PACKAGE_PATH = "/install/package.json";

const UNREAD: ReturnType<FileTextPort["read"]> = { outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } };

const filesWith = (request: { readonly read: ReturnType<FileTextPort["read"]> }): FileTextPort => ({
  read: ({ path }) => ({ [PACKAGE_PATH]: request.read })[path] ?? UNREAD,
  exists: vi.fn<FileTextPort["exists"]>(),
  write: vi.fn<FileTextPort["write"]>(),
});

const versionFrom = (request: { readonly read: ReturnType<FileTextPort["read"]> }) =>
  installedVersionOf({
    fileText: filesWith(request),
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/work" }),
    moduleUrl: "file:///install/src/hone.ts",
  });

describe("installedVersionOf", () => {
  it("reads the version from the package.json of the install the command runs from", () => {
    expect(versionFrom({ read: { outcome: "ok", value: JSON.stringify({ name: "@hailstails/hone", version: "1.0.0" }) } })).toEqual({
      outcome: "ok",
      value: "1.0.0",
    });
  });

  it("is file-unreadable when the install's package.json cannot be read", () => {
    expect(versionFrom({ read: { outcome: "failed", error: { kind: "unreadable", path: PACKAGE_PATH, detail: "EACCES" } } })).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", path: PACKAGE_PATH, detail: "EACCES" },
    });
  });

  it("is file-malformed saying so when the install's package.json is not JSON", () => {
    expect(versionFrom({ read: { outcome: "ok", value: "{" } })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: PACKAGE_PATH, detail: expect.stringMatching(/^package\.json is not valid JSON: /) },
    });
  });

  it("is file-malformed when the install's package.json holds no version", () => {
    expect(versionFrom({ read: { outcome: "ok", value: JSON.stringify({ name: "@hailstails/hone" }) } })).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: PACKAGE_PATH, detail: "package.json holds no version" },
    });
  });
});

describe("installedVersionOf on Windows", () => {
  it("names the install's package.json with forward slashes when it cannot be read", () => {
    expect(
      installedVersionOf({
        fileText: filesWith({ read: { outcome: "ok", value: "{}" } }),
        path: createPathPort({ flavour: "windows", workingDirectory: () => "C:/work" }),
        moduleUrl: "file:///C:/hone/src/hone.ts",
      }),
    ).toMatchObject({ outcome: "failed", error: { kind: "file-unreadable", path: "C:/hone/package.json" } });
  });
});
