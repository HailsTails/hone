import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../infrastructure/node/file-system/file-text-port.ts";
import { createPathPort } from "../../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../../infrastructure/content-files/absolute-path.ts";
import { repoPathSchema } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import { teamConfigsOf, type TeamConfigsRequest } from "./team-config-finder.ts";

const PROJECTION = repoPathSchema.parse("disciplines.eslint.mjs");

const SLICE = repoPathSchema.parse("packages/a/disciplines.eslint.mjs");

const IMPORTING = 'import disciplines from "./disciplines.eslint.mjs";\nexport default [...disciplines];\n';

const UNRELATED = "export default [];\n";

const requestOver = (overrides: Partial<TeamConfigsRequest>): TeamConfigsRequest => ({
  repoRoot: absolutePathSchema.parse("/repo"),
  fileText: { read: vi.fn<FileTextPort["read"]>() },
  path: createPathPort({ flavour: "posix", workingDirectory: () => "/repo" }),
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
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("src/a.ts"), repoPathSchema.parse("disciplines.eslint.mjs"), repoPathSchema.parse("README.md")],
      fileText: { read },
    });
    expect(teamConfigsOf(request)).toEqual({ outcome: "ok", value: [{ projection: "disciplines.eslint.mjs", teamConfigs: [{ file: "eslint.config.mjs", text: IMPORTING }] }] });
    expect(read.mock.calls).toEqual([[{ path: "/repo/eslint.config.mjs" }], [{ path: "/repo/src/a.ts" }]]);
  });

  it("finds the config of each projection, the root one and a package slice, reading every script once", () => {
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
      .mockReturnValueOnce({ outcome: "ok", value: IMPORTING });
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("packages/a/eslint.config.mjs"), repoPathSchema.parse("disciplines.eslint.mjs"), SLICE],
      projections: [PROJECTION, SLICE],
      fileText: { read },
    });
    expect(teamConfigsOf(request)).toEqual({
      outcome: "ok",
      value: [
        { projection: "disciplines.eslint.mjs", teamConfigs: [{ file: "eslint.config.mjs", text: IMPORTING }] },
        { projection: "packages/a/disciplines.eslint.mjs", teamConfigs: [{ file: "packages/a/eslint.config.mjs", text: IMPORTING }] },
      ],
    });
    expect(read.mock.calls).toEqual([[{ path: "/repo/eslint.config.mjs" }], [{ path: "/repo/packages/a/eslint.config.mjs" }]]);
  });

  it("resolves the import relative to the importing file", () => {
    const nested = 'import disciplines from "../disciplines.eslint.mjs";\n';
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("config/eslint.config.mjs")],
      fileText: fileTextHolding({ text: nested }),
    });
    expect(teamConfigsOf(request)).toEqual({ outcome: "ok", value: [{ projection: "disciplines.eslint.mjs", teamConfigs: [{ file: "config/eslint.config.mjs", text: nested }] }] });
  });

  it("refuses naming the projection when no tracked script imports it", () => {
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs")],
      fileText: fileTextHolding({ text: UNRELATED }),
    });
    expect(teamConfigsOf(request)).toEqual({ outcome: "failed", error: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } });
  });

  it("refuses naming the slice whose package config does not import it", () => {
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("packages/a/eslint.config.mjs")],
      projections: [PROJECTION, SLICE],
      fileText: {
        read: vi
          .fn<FileTextPort["read"]>()
          .mockReturnValueOnce({ outcome: "ok", value: IMPORTING })
          .mockReturnValueOnce({ outcome: "ok", value: UNRELATED }),
      },
    });
    expect(teamConfigsOf(request)).toEqual({ outcome: "failed", error: { kind: "no-file-imports-projection", projection: "packages/a/disciplines.eslint.mjs" } });
  });

  it("gives every script that imports it, in the order git lists them", () => {
    const request = requestOver({
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs"), repoPathSchema.parse("lint.config.js")],
      fileText: fileTextHolding({ text: IMPORTING }),
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
      trackedPaths: [repoPathSchema.parse("eslint.config.mjs")],
      fileText: { read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "/repo/eslint.config.mjs", detail: "ENOENT" } }) },
    });
    expect(teamConfigsOf(request)).toEqual({ outcome: "failed", error: { kind: "config-candidate-unreadable", file: "eslint.config.mjs", detail: "ENOENT" } });
  });

  it("reads no script under node_modules", () => {
    const request = requestOver({ trackedPaths: [repoPathSchema.parse("node_modules/x/index.js")] });
    expect(teamConfigsOf(request)).toEqual({ outcome: "failed", error: { kind: "no-file-imports-projection", projection: "disciplines.eslint.mjs" } });
    expect(request.fileText.read).not.toHaveBeenCalled();
  });

  it("finds no team config, and reads nothing, when version 1 wrote no projection", () => {
    const request = requestOver({ projections: [], trackedPaths: [repoPathSchema.parse("eslint.config.mjs")] });
    expect(teamConfigsOf(request)).toEqual({ outcome: "ok", value: [] });
    expect(request.fileText.read).not.toHaveBeenCalled();
  });
});
