import { describe, expect, it, vi } from "vitest";

import { createConsumerFiles } from "./consumer-files.ts";
import type { ModuleFilesPort } from "./module-files-port.ts";

describe("createConsumerFiles, for a consumer's own texts and the packages written for it", () => {
  it("holds each text under the consumer's root and each package's under its node_modules, without asking the disk", () => {
    const disk = {
      readKind: vi.fn<ModuleFilesPort["readKind"]>(),
      readText: vi.fn<ModuleFilesPort["readText"]>(),
      resolvePath: vi.fn<ModuleFilesPort["resolvePath"]>(),
    };
    const files = createConsumerFiles({
      disk,
      contents: {
        texts: [{ path: "nested/entry.ts", text: "entry" }],
        packages: [
          { kind: "written", name: "counted", texts: [{ path: "counted.d.ts", text: "counted" }] },
        ],
      },
    });

    const answers = {
      entry: files.readText({ path: "/consumer/nested/entry.ts" }),
      counted: files.readText({ path: "/consumer/node_modules/counted/counted.d.ts" }),
      entryKind: files.readKind({ path: "/consumer/nested/entry.ts" }),
      nestedKind: files.readKind({ path: "/consumer/nested" }),
      besideKind: files.readKind({ path: "/consumer/nest" }),
      resolved: files.resolvePath({ path: "/consumer/nested/entry.ts" }),
    };

    expect(answers).toEqual({
      entry: "entry",
      counted: "counted",
      entryKind: "file",
      nestedKind: "directory",
      besideKind: "absent",
      resolved: "/consumer/nested/entry.ts",
    });
    expect(disk.readKind).not.toHaveBeenCalled();
    expect(disk.readText).not.toHaveBeenCalled();
    expect(disk.resolvePath).not.toHaveBeenCalled();
  });

  it("holds nothing the consumer was not given, without asking the disk", () => {
    const disk = {
      readKind: vi.fn<ModuleFilesPort["readKind"]>(),
      readText: vi.fn<ModuleFilesPort["readText"]>(),
      resolvePath: vi.fn<ModuleFilesPort["resolvePath"]>(),
    };
    const files = createConsumerFiles({
      disk,
      contents: { texts: [{ path: "entry.ts", text: "entry" }], packages: [] },
    });

    const answers = {
      text: files.readText({ path: "/work/node_modules/eslint/package.json" }),
      file: files.readKind({ path: "/work/node_modules/eslint/package.json" }),
      directory: files.readKind({ path: "/work/node_modules" }),
      resolved: files.resolvePath({ path: "/work/node_modules/eslint" }),
    };

    expect(answers).toEqual({
      text: undefined,
      file: "absent",
      directory: "absent",
      resolved: "/work/node_modules/eslint",
    });
    expect(disk.readKind).not.toHaveBeenCalled();
    expect(disk.readText).not.toHaveBeenCalled();
    expect(disk.resolvePath).not.toHaveBeenCalled();
  });
});

describe("createConsumerFiles, for a package installed on disk", () => {
  it("reads the package under the consumer's name for it from the folder it is installed in", () => {
    const disk = {
      readKind: vi.fn<ModuleFilesPort["readKind"]>().mockReturnValue("file"),
      readText: vi.fn<ModuleFilesPort["readText"]>().mockReturnValue("installed"),
      resolvePath: vi.fn<ModuleFilesPort["resolvePath"]>().mockReturnValue("C:/work/node_modules"),
    };
    const files = createConsumerFiles({
      disk,
      contents: {
        texts: [],
        packages: [
          {
            kind: "installed",
            name: "eslint",
            nodeModules: "C:\\work\\node_modules",
            folder: "eslint-9",
          },
        ],
      },
    });

    const answers = {
      text: files.readText({ path: "/consumer/node_modules/eslint/index.d.ts" }),
      file: files.readKind({ path: "/consumer/node_modules/eslint/package.json" }),
      modules: files.readKind({ path: "/consumer/node_modules" }),
      sibling: files.readText({ path: "/consumer/node_modules/eslint-scope/index.d.ts" }),
      resolved: files.resolvePath({ path: "/consumer/node_modules/eslint" }),
    };

    expect(answers).toEqual({
      text: "installed",
      file: "file",
      modules: "directory",
      sibling: undefined,
      resolved: "C:/work/node_modules",
    });
    expect(disk.readText).toHaveBeenCalledExactlyOnceWith({
      path: "C:/work/node_modules/eslint-9/index.d.ts",
    });
    expect(disk.readKind).toHaveBeenCalledExactlyOnceWith({
      path: "C:/work/node_modules/eslint-9/package.json",
    });
    expect(disk.resolvePath.mock.calls).toEqual([
      [{ path: "C:\\work\\node_modules" }],
      [{ path: "C:/work/node_modules/eslint-9" }],
    ]);
  });

  it("reads what the package itself depends on from the node_modules it is installed in", () => {
    const disk = {
      readKind: vi.fn<ModuleFilesPort["readKind"]>(),
      readText: vi.fn<ModuleFilesPort["readText"]>().mockReturnValue("dependency"),
      resolvePath: vi
        .fn<ModuleFilesPort["resolvePath"]>()
        .mockReturnValue("D:\\real\\node_modules"),
    };
    const files = createConsumerFiles({
      disk,
      contents: {
        texts: [],
        packages: [
          {
            kind: "installed",
            name: "eslint",
            nodeModules: "C:/work/node_modules",
            folder: "eslint",
          },
        ],
      },
    });

    const text = files.readText({ path: "D:/real/node_modules/estree/index.d.ts" });

    expect(text).toBe("dependency");
    expect(disk.readText).toHaveBeenCalledExactlyOnceWith({
      path: "D:/real/node_modules/estree/index.d.ts",
    });
    expect(disk.resolvePath).toHaveBeenCalledExactlyOnceWith({ path: "C:/work/node_modules" });
  });
});
