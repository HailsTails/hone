import { assert, describe, expect, it, vi } from "vitest";
import type { PathPort } from "../../node/path-port.ts";
import { absolutePathSchema } from "../../content-files/absolute-path.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { installRootOf, installRootOfApiEntry } from "./install-root.ts";

const requiredEntry = <Entry>(request: { readonly table: Readonly<Record<string, Entry>>; readonly key: string }): Entry => {
  const entry = request.table[request.key];
  assert(entry !== undefined, `the fake table holds no entry for ${request.key}`);
  return entry;
};

const ENTRY_URL = "file:///install/src/hone.ts";
const API_ENTRY_URL = "file:///install/api/testing.js";
const NOT_A_FILE_URL = "https://example.invalid/src/hone.ts";
const WINDOWS_ENTRY_URL = "file:///C:/repo/packages/hone/src/hone.ts";

type FileUrlResult = Result<
  AbsolutePath,
  { readonly kind: "not-a-file-url"; readonly url: string; readonly detail: string }
>;

const FILE_URLS: Readonly<Record<string, FileUrlResult>> = {
  [ENTRY_URL]: { outcome: "ok", value: absolutePathSchema.parse("/install/src/hone.ts") },
  [API_ENTRY_URL]: { outcome: "ok", value: absolutePathSchema.parse("/install/api/testing.js") },
  [WINDOWS_ENTRY_URL]: {
    outcome: "ok",
    value: absolutePathSchema.parse("C:\\repo\\packages\\hone\\src\\hone.ts"),
  },
  [NOT_A_FILE_URL]: {
    outcome: "failed",
    error: { kind: "not-a-file-url", url: NOT_A_FILE_URL, detail: "the text is not a file: URL" },
  },
};

const DIRECTORIES: Readonly<Record<string, string>> = {
  "/install/src/hone.ts": "/install/src",
  "/install/src": "/install",
  "/install/api/testing.js": "/install/api",
  "/install/api": "/install",
  "C:\\repo\\packages\\hone\\src\\hone.ts": "C:\\repo\\packages\\hone\\src",
  "C:\\repo\\packages\\hone\\src": "C:\\repo\\packages\\hone",
};

const TABLE_PATH: PathPort = {
  join: vi.fn<PathPort["join"]>(),
  relative: vi.fn<PathPort["relative"]>(),
  joinRepository: vi.fn<PathPort["joinRepository"]>(),
  directoryOf: ({ path }) => requiredEntry({ table: DIRECTORIES, key: path }),
  repositoryDirectoryOf: vi.fn<PathPort["repositoryDirectoryOf"]>(),
  resolve: ({ path }) => ({ outcome: "ok", value: absolutePathSchema.parse(path) }),
  fromFileUrl: ({ url }) => requiredEntry({ table: FILE_URLS, key: url }),
};

const UNRESOLVABLE_PATH: PathPort = {
  ...TABLE_PATH,
  resolve: ({ path }) => ({ outcome: "failed", error: { kind: "working-directory-unusable", path } }),
};

describe("installRootOf", () => {
  it("is the directory two levels above the entry file", () => {
    expect(installRootOf({ path: TABLE_PATH, moduleUrl: ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "/install",
    });
  });

  it("is the drive-rooted directory two levels above a Windows entry file", () => {
    expect(installRootOf({ path: TABLE_PATH, moduleUrl: WINDOWS_ENTRY_URL })).toEqual({
      outcome: "ok",
      value: "C:\\repo\\packages\\hone",
    });
  });

  it("is install-root-unresolvable with the URL when the module URL is not a file URL", () => {
    expect(installRootOf({ path: TABLE_PATH, moduleUrl: NOT_A_FILE_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: NOT_A_FILE_URL,
        detail: "the text is not a file: URL",
      },
    });
  });

  it("is install-root-unresolvable with the module URL when the directory above the entry file resolves to no absolute path", () => {
    expect(installRootOf({ path: UNRESOLVABLE_PATH, moduleUrl: ENTRY_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: ENTRY_URL,
        detail: "the install root two directories above the entry file is not an absolute path",
      },
    });
  });
});

describe("installRootOfApiEntry", () => {
  it("is the directory two levels above a public entry file under api/", () => {
    expect(installRootOfApiEntry({ path: TABLE_PATH, moduleUrl: API_ENTRY_URL })).toEqual({ outcome: "ok", value: "/install" });
  });

  it("is install-root-unresolvable with the module URL when the directory above the entry file resolves to no absolute path", () => {
    expect(installRootOfApiEntry({ path: UNRESOLVABLE_PATH, moduleUrl: API_ENTRY_URL })).toEqual({
      outcome: "failed",
      error: {
        kind: "install-root-unresolvable",
        url: API_ENTRY_URL,
        detail: "the install root two directories above the entry file is not an absolute path",
      },
    });
  });
});