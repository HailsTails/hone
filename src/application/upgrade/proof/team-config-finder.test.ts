import { describe, expect, it, vi } from "vitest";

import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../domain/repository/repo-path-of.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import { teamConfigsOf, type TeamConfigsRequest } from "./team-config-finder.ts";

const PROJECTION = repoPathOf("disciplines.eslint.mjs");

const SLICE = repoPathOf("packages/a/disciplines.eslint.mjs");

const IMPORTING =
  'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const UNRELATED = "export default [];\n";

const requestOver = (overrides: Partial<TeamConfigsRequest>): TeamConfigsRequest => ({
  repoRoot: absoluteRootOf("/repo"),
  fileText: { read: vi.fn<FileTextPort["read"]>() },
  path: { join: vi.fn<PathPort["join"]>() },
  trackedPaths: [],
  projections: [PROJECTION],
  ...overrides,
});

const fileTextHolding = (request: { readonly text: string }): Pick<FileTextPort, "read"> => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "ok", value: request.text }),
});

describe("teamConfigsOf", () => {
  it("finds the one tracked script whose static import resolves to the version 1 projection", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
      .mockReturnValueOnce({ outcome: "ok", value: UNRELATED });
    const request = requestOver({
      trackedPaths: [
        repoPathOf("eslint.config.mjs"),
        repoPathOf("src/a.ts"),
        repoPathOf("disciplines.eslint.mjs"),
        repoPathOf("README.md"),
      ],
      fileText: { read },
      path: {
        join: vi
          .fn<PathPort["join"]>()
          .mockReturnValueOnce("/repo/eslint.config.mjs")
          .mockReturnValueOnce("/repo/src/a.ts"),
      },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [
        {
          projection: "disciplines.eslint.mjs",
          teamConfigs: [{ file: "eslint.config.mjs", text: IMPORTING }],
        },
      ],
    });
    expect(read.mock.calls).toEqual([
      [{ path: "/repo/eslint.config.mjs" }],
      [{ path: "/repo/src/a.ts" }],
    ]);
  });

  it("finds the config of each projection, the root one and a package slice, reading every script once", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
      .mockReturnValueOnce({ outcome: "ok", value: IMPORTING });
    const request = requestOver({
      trackedPaths: [
        repoPathOf("eslint.config.mjs"),
        repoPathOf("packages/a/eslint.config.mjs"),
        repoPathOf("disciplines.eslint.mjs"),
        SLICE,
      ],
      projections: [PROJECTION, SLICE],
      fileText: { read },
      path: {
        join: vi
          .fn<PathPort["join"]>()
          .mockReturnValueOnce("/repo/eslint.config.mjs")
          .mockReturnValueOnce("/repo/packages/a/eslint.config.mjs"),
      },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [
        {
          projection: "disciplines.eslint.mjs",
          teamConfigs: [{ file: "eslint.config.mjs", text: IMPORTING }],
        },
        {
          projection: "packages/a/disciplines.eslint.mjs",
          teamConfigs: [{ file: "packages/a/eslint.config.mjs", text: IMPORTING }],
        },
      ],
    });
    expect(read.mock.calls).toEqual([
      [{ path: "/repo/eslint.config.mjs" }],
      [{ path: "/repo/packages/a/eslint.config.mjs" }],
    ]);
  });

  it("resolves the import relative to the importing file", () => {
    const nested = 'import disciplines from "../disciplines.eslint.mjs";\n';
    const request = requestOver({
      trackedPaths: [repoPathOf("config/eslint.config.mjs")],
      fileText: fileTextHolding({ text: nested }),
      path: {
        join: vi.fn<PathPort["join"]>().mockReturnValueOnce("/repo/config/eslint.config.mjs"),
      },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [
        {
          projection: "disciplines.eslint.mjs",
          teamConfigs: [{ file: "config/eslint.config.mjs", text: nested }],
        },
      ],
    });
  });

  it("refuses naming the projection when no tracked script imports it and an ESLint config sits beside it", () => {
    const request = requestOver({
      trackedPaths: [repoPathOf("eslint.config.mjs")],
      fileText: fileTextHolding({ text: UNRELATED }),
      path: { join: vi.fn<PathPort["join"]>().mockReturnValueOnce("/repo/eslint.config.mjs") },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "failed",
      error: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" },
    });
  });

  it("refuses naming the slice whose package config does not import it", () => {
    const request = requestOver({
      trackedPaths: [repoPathOf("eslint.config.mjs"), repoPathOf("packages/a/eslint.config.mjs")],
      projections: [PROJECTION, SLICE],
      fileText: {
        read: vi
          .fn<FileTextPort["read"]>()
          .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
          .mockReturnValueOnce({ outcome: "ok", value: UNRELATED }),
      },
      path: {
        join: vi
          .fn<PathPort["join"]>()
          .mockReturnValueOnce("/repo/eslint.config.mjs")
          .mockReturnValueOnce("/repo/packages/a/eslint.config.mjs"),
      },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "failed",
      error: {
        kind: "no-file-imports-projection",
        projection: "packages/a/disciplines.eslint.mjs",
      },
    });
  });

  it("gives every script that imports it, in the order git lists them", () => {
    const request = requestOver({
      trackedPaths: [repoPathOf("eslint.config.mjs"), repoPathOf("lint.config.js")],
      fileText: fileTextHolding({ text: IMPORTING }),
      path: {
        join: vi
          .fn<PathPort["join"]>()
          .mockReturnValueOnce("/repo/eslint.config.mjs")
          .mockReturnValueOnce("/repo/lint.config.js"),
      },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [
        {
          projection: "disciplines.eslint.mjs",
          teamConfigs: [
            { file: "eslint.config.mjs", text: IMPORTING },
            { file: "lint.config.js", text: IMPORTING },
          ],
        },
      ],
    });
  });

  it("refuses when a candidate script cannot be read", () => {
    const request = requestOver({
      trackedPaths: [repoPathOf("eslint.config.mjs")],
      fileText: {
        read: vi.fn<FileTextPort["read"]>().mockReturnValue({
          outcome: "failed",
          error: { kind: "unreadable", path: "/repo/eslint.config.mjs", detail: "ENOENT" },
        }),
      },
      path: { join: vi.fn<PathPort["join"]>().mockReturnValueOnce("/repo/eslint.config.mjs") },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "failed",
      error: { kind: "config-candidate-unreadable", file: "eslint.config.mjs", detail: "ENOENT" },
    });
  });

  it("gives a projection no team config when nothing imports it and no ESLint config sits in its folder", () => {
    const request = requestOver({
      trackedPaths: [
        repoPathOf("packages/a/eslint.config.mjs"),
        repoPathOf("my-eslint.config.mjs"),
      ],
      projections: [PROJECTION, SLICE],
      fileText: {
        read: vi
          .fn<FileTextPort["read"]>()
          .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
          .mockReturnValueOnce({ outcome: "ok", value: UNRELATED }),
      },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [
        { projection: "disciplines.eslint.mjs", teamConfigs: [] },
        {
          projection: "packages/a/disciplines.eslint.mjs",
          teamConfigs: [{ file: "packages/a/eslint.config.mjs", text: IMPORTING }],
        },
      ],
    });
  });

  it("reads no script under node_modules", () => {
    const request = requestOver({ trackedPaths: [repoPathOf("node_modules/x/index.js")] });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [{ projection: "disciplines.eslint.mjs", teamConfigs: [] }],
    });
    expect(request.fileText.read).not.toHaveBeenCalled();
  });

  it("finds no team config, and reads nothing, when version 1 wrote no projection", () => {
    const request = requestOver({
      projections: [],
      trackedPaths: [repoPathOf("eslint.config.mjs")],
    });
    expect(teamConfigsOf(request)).toEqual({ outcome: "ok", value: [] });
    expect(request.fileText.read).not.toHaveBeenCalled();
  });
});
