import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../../../domain/repository/absolute-root-of.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { createPathPort } from "../../../../node/path-port.ts";
import type { CoreInstall } from "./core-install.ts";
import {
  escapedGlobPath,
  currentProjection,
  pluginImportOf,
  projectionState,
  writeProjection,
} from "./projection.ts";

const PROJECTION_PATH = repoPathOf("disciplines.eslint.mjs");

const repoRoot = absoluteRootOf("/repo");
const windowsRepoRoot = absoluteRootOf("C:\\repo");
const posixPath = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });
const windowsPath = createPathPort({ flavour: "windows", workingDirectory: () => "C:\\repo" });

const SOURCE_INSTALL: CoreInstall = { form: "source" };

const PACKAGED_INSTALL: CoreInstall = {
  form: "package",
  root: "/repo/node_modules/@hailstails/hone",
  name: "@hailstails/hone",
};

const enablingOnlyProjection = `import piece0 from "./node_modules/@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

describe("escapedGlobPath", () => {
  it("backslash-escapes each of \\ * ? [ ] { } ( ) ! + @ so the path matches only itself", () => {
    expect(escapedGlobPath({ path: String.raw`a\b*c?d[e]f{g}h(i)j!k+l@m.ts` })).toBe(
      String.raw`a\\b\*c\?d\[e\]f\{g\}h\(i\)j\!k\+l\@m.ts`,
    );
  });

  it("escapes the brackets of route/[id].ts", () => {
    expect(escapedGlobPath({ path: "route/[id].ts" })).toBe(String.raw`route/\[id\].ts`);
  });
});

describe("pluginImportOf", () => {
  it("joins the piece root and plugin module and makes the result relative to the importing directory", () => {
    const join = vi
      .fn()
      .mockReturnValue("/repo/node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts");
    const relative = vi.fn().mockReturnValue({
      relation: "within-root",
      path: "node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
    const path: PathPort = {
      join,
      joinRepository: vi.fn(),
      relative,
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    pluginImportOf({
      path,
      importingDirectory: repoRoot,
      install: SOURCE_INSTALL,
      pieceRoot: "/repo/node_modules/dc/mechanisms/eslint/CD-14",
      pluginModule: "cd14/cd14.eslint-plugin.ts",
    });

    expect(join).toHaveBeenCalledWith({
      segments: ["/repo/node_modules/dc/mechanisms/eslint/CD-14", "cd14/cd14.eslint-plugin.ts"],
    });
    expect(relative).toHaveBeenCalledWith({
      from: "/repo",
      to: "/repo/node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("prefixes ./ to a module inside the repository", () => {
    const path: PathPort = {
      join: vi
        .fn()
        .mockReturnValue(
          "/repo/node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
        ),
      joinRepository: vi.fn(),
      relative: vi.fn().mockReturnValue({
        relation: "within-root",
        path: "node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
      }),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    expect(
      pluginImportOf({
        path,
        importingDirectory: repoRoot,
        install: SOURCE_INSTALL,
        pieceRoot: "/repo/node_modules/dc/mechanisms/eslint/CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "./node_modules/dc/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("keeps a module outside the repository as its ../ path", () => {
    const path: PathPort = {
      join: vi.fn().mockReturnValue("/team-rules/mechanisms/eslint/PD-1/plugin.ts"),
      joinRepository: vi.fn(),
      relative: vi.fn().mockReturnValue({
        relation: "within-root",
        path: "../team-rules/mechanisms/eslint/PD-1/plugin.ts",
      }),
      directoryOf: vi.fn(),
      repositoryDirectoryOf: vi.fn(),
      resolve: vi.fn(),
      fromFileUrl: vi.fn(),
    };

    expect(
      pluginImportOf({
        path,
        importingDirectory: repoRoot,
        install: SOURCE_INSTALL,
        pieceRoot: "/team-rules/mechanisms/eslint/PD-1",
        pluginModule: "plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "../team-rules/mechanisms/eslint/PD-1/plugin.ts",
    });
  });

  it("imports a Windows piece inside the repository by a ./ specifier in forward slashes", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        importingDirectory: windowsRepoRoot,
        install: SOURCE_INSTALL,
        pieceRoot: "C:\\repo\\tools\\discipline\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "./tools/discipline/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.ts",
    });
  });

  it("reports a piece on another drive from the repository as piece-on-another-root", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        importingDirectory: windowsRepoRoot,
        install: SOURCE_INSTALL,
        pieceRoot: "D:\\dc\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.ts",
      }),
    ).toEqual({ placement: "piece-on-another-root" });
  });

  it("imports a shipped piece of a packaged core install by the package name and its path inside the package", () => {
    expect(
      pluginImportOf({
        path: posixPath,
        importingDirectory: repoRoot,
        install: PACKAGED_INSTALL,
        pieceRoot: "/repo/node_modules/@hailstails/hone/mechanisms/eslint/CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.js",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js",
    });
  });

  it("imports a shipped piece of a scoped package installed through a package store by the package name", () => {
    expect(
      pluginImportOf({
        path: posixPath,
        importingDirectory: repoRoot,
        install: {
          form: "package",
          root: "/repo/node_modules/.pnpm/node_modules/@team/hone",
          name: "@team/hone",
        },
        pieceRoot: "/repo/node_modules/.pnpm/node_modules/@team/hone/mechanisms/eslint/CD-1",
        pluginModule: "cd1/cd1.eslint-plugin.js",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "@team/hone/mechanisms/eslint/CD-1/cd1/cd1.eslint-plugin.js",
    });
  });

  it("imports a shipped piece of a packaged install on Windows by the package name in forward slashes", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        importingDirectory: windowsRepoRoot,
        install: { form: "package", root: "C:\\repo\\node_modules\\team-hone", name: "team-hone" },
        pieceRoot: "C:\\repo\\node_modules\\team-hone\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.js",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "team-hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js",
    });
  });

  it("imports a shipped piece of a scoped package installed on Windows under a two-segment root by the package name in forward slashes", () => {
    expect(
      pluginImportOf({
        path: windowsPath,
        importingDirectory: windowsRepoRoot,
        install: {
          form: "package",
          root: "C:\\repo\\node_modules\\@hailstails\\hone",
          name: "@hailstails/hone",
        },
        pieceRoot: "C:\\repo\\node_modules\\@hailstails\\hone\\mechanisms\\eslint\\CD-14",
        pluginModule: "cd14/cd14.eslint-plugin.js",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "@hailstails/hone/mechanisms/eslint/CD-14/cd14/cd14.eslint-plugin.js",
    });
  });

  it("keeps the repository's own piece, outside a packaged core install, as its relative path", () => {
    expect(
      pluginImportOf({
        path: posixPath,
        importingDirectory: repoRoot,
        install: PACKAGED_INSTALL,
        pieceRoot: "/repo/tools/team-rules/mechanisms/eslint/PD-1",
        pluginModule: "plugin.ts",
      }),
    ).toEqual({
      placement: "importable",
      specifier: "./tools/team-rules/mechanisms/eslint/PD-1/plugin.ts",
    });
  });
});

describe("projectionState", () => {
  it("is missing when there is no projection file", () => {
    expect(
      projectionState({ current: { presence: "absent" }, generated: enablingOnlyProjection }),
    ).toBe("missing");
  });

  it("is current when the file's bytes equal the generation", () => {
    expect(
      projectionState({
        current: { presence: "present", text: enablingOnlyProjection },
        generated: enablingOnlyProjection,
      }),
    ).toBe("current");
  });

  it("is out-of-date when the file differs only by its trailing newline", () => {
    expect(
      projectionState({
        current: { presence: "present", text: "export default [];" },
        generated: "export default [];\n",
      }),
    ).toBe("out-of-date");
  });

  it("is out-of-date when the file is hand-edited", () => {
    expect(
      projectionState({
        current: { presence: "present", text: "export default [];\n" },
        generated: enablingOnlyProjection,
      }),
    ).toBe("out-of-date");
  });
});

describe("currentProjection", () => {
  it("reads a projection with CRLF line endings as the same text with LF line endings", () => {
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [\r\n];\r\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write: vi.fn(),
    };

    expect(
      currentProjection({ fileText, path: posixPath, repoRoot, file: PROJECTION_PATH }),
    ).toEqual({
      outcome: "ok",
      value: { presence: "present", text: "export default [\n];\n" },
    });
  });
});

describe("writeProjection", () => {
  it("leaves a projection that differs only by CRLF line endings alone, and reports it unchanged", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [\r\n];\r\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect({
      result: writeProjection({
        fileText,
        path: posixPath,
        repoRoot,
        file: PROJECTION_PATH,
        text: "export default [\n];\n",
      }),
      writes: write.mock.calls,
    }).toEqual({
      result: { outcome: "ok", value: { path: "disciplines.eslint.mjs", effect: "unchanged" } },
      writes: [],
    });
  });

  it("writes disciplines.eslint.mjs at the repo root when no projection exists, and reports it written", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn(),
      exists: vi.fn().mockReturnValue("absent"),
      write,
    };

    expect(
      writeProjection({
        fileText,
        path: posixPath,
        repoRoot,
        file: PROJECTION_PATH,
        text: enablingOnlyProjection,
      }),
    ).toEqual({
      outcome: "ok",
      value: { path: "disciplines.eslint.mjs", effect: "written" },
    });
    expect(write).toHaveBeenCalledWith({
      path: "/repo/disciplines.eslint.mjs",
      text: enablingOnlyProjection,
    });
  });

  it("rewrites a projection whose bytes differ, and reports it written", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: "export default [];\n" }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect(
      writeProjection({
        fileText,
        path: posixPath,
        repoRoot,
        file: PROJECTION_PATH,
        text: enablingOnlyProjection,
      }),
    ).toEqual({
      outcome: "ok",
      value: { path: "disciplines.eslint.mjs", effect: "written" },
    });
    expect(write).toHaveBeenCalledWith({
      path: "/repo/disciplines.eslint.mjs",
      text: enablingOnlyProjection,
    });
  });

  it("leaves a byte-identical projection alone, and reports it unchanged", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({ outcome: "ok", value: enablingOnlyProjection }),
      exists: vi.fn().mockReturnValue("present"),
      write,
    };

    expect(
      writeProjection({
        fileText,
        path: posixPath,
        repoRoot,
        file: PROJECTION_PATH,
        text: enablingOnlyProjection,
      }),
    ).toEqual({
      outcome: "ok",
      value: { path: "disciplines.eslint.mjs", effect: "unchanged" },
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("reports an existing projection it cannot read as file-unreadable", () => {
    const fileText: FileTextPort = {
      read: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "unreadable", path: "/repo/disciplines.eslint.mjs", detail: "EACCES" },
      }),
      exists: vi.fn().mockReturnValue("present"),
      write: vi.fn(),
    };

    expect(
      writeProjection({
        fileText,
        path: posixPath,
        repoRoot,
        file: PROJECTION_PATH,
        text: enablingOnlyProjection,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-unreadable", file: "disciplines.eslint.mjs", detail: "EACCES" },
    });
  });

  it("reports a projection it cannot write as tool-failed carrying the port's detail", () => {
    const fileText: FileTextPort = {
      read: vi.fn(),
      exists: vi.fn().mockReturnValue("absent"),
      write: vi.fn().mockReturnValue({
        outcome: "failed",
        error: { kind: "unwritable", path: "/repo/disciplines.eslint.mjs", detail: "EROFS" },
      }),
    };

    expect(
      writeProjection({
        fileText,
        path: posixPath,
        repoRoot,
        file: PROJECTION_PATH,
        text: enablingOnlyProjection,
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "EROFS" },
    });
  });
});

describe("projection file location on Windows", () => {
  it("asks the file port whether the projection exists, and reads it, at its Windows form under the repo root", () => {
    const exists = vi.fn().mockReturnValue("present");
    const read = vi.fn().mockReturnValue({ outcome: "ok", value: enablingOnlyProjection });
    const fileText: FileTextPort = { read, exists, write: vi.fn() };

    currentProjection({
      fileText,
      path: windowsPath,
      repoRoot: windowsRepoRoot,
      file: PROJECTION_PATH,
    });

    expect({ exists: exists.mock.calls, read: read.mock.calls }).toEqual({
      exists: [[{ path: "C:\\repo\\disciplines.eslint.mjs" }]],
      read: [[{ path: "C:\\repo\\disciplines.eslint.mjs" }]],
    });
  });

  it("writes the projection at its Windows form under the repo root", () => {
    const write = vi.fn().mockReturnValue({ outcome: "ok", value: undefined });
    const fileText: FileTextPort = {
      read: vi.fn(),
      exists: vi.fn().mockReturnValue("absent"),
      write,
    };

    writeProjection({
      fileText,
      path: windowsPath,
      repoRoot: windowsRepoRoot,
      file: PROJECTION_PATH,
      text: enablingOnlyProjection,
    });

    expect(write.mock.calls).toEqual([
      [{ path: "C:\\repo\\disciplines.eslint.mjs", text: enablingOnlyProjection }],
    ]);
  });
});
