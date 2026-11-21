import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../infrastructure/node/file-system/file-text-port.ts";
import type { ModuleLoaderPort } from "../../infrastructure/node/modules/module-loader-port.ts";
import type { PathPort } from "../../infrastructure/node/path-port.ts";
import { absolutePathSchema } from "../../infrastructure/content-files/absolute-path.ts";
import { mechanismIdSchema } from "../../infrastructure/hone-config-file/identifiers.ts";
import { repoPathSchema } from "../../infrastructure/hone-records-folder/repo-path.ts";
import { createConformanceTesting } from "./conformance-testing.ts";

const AUDIT = mechanismIdSchema.parse("audit");

const BUILT_ENTRY_URL = "file:///install/api/testing.js";
const RUNNER_PATH = "/install/src/infrastructure/engines/audit/runner/runner.js";

const unreadableFileText = (): FileTextPort => ({
  read: vi.fn<FileTextPort["read"]>().mockReturnValue({ outcome: "failed", error: { kind: "unreadable", path: "", detail: "ENOENT" } }),
  exists: vi.fn(),
  write: vi.fn(),
});

const acmeFileText = (): FileTextPort => ({
  read: vi
    .fn<FileTextPort["read"]>()
    .mockReturnValueOnce({
      outcome: "ok",
      value: JSON.stringify({
        version: 1,
        id: "ACME-2",
        clauses: [
          {
            kind: "mechanical",
            id: "scratch-files",
            summary: "no scratch file is committed",
            mechanisms: ["audit"],
            anchor: { kind: "file" },
            cases: {
              flag: [{ name: "scratch file", fileName: "src/draft.scratch.ts", source: "", expectedLines: [1] }],
              allow: [{ name: "ordinary file", fileName: "src/kept.ts", source: "", expectedLines: [] }],
            },
          },
        ],
      }),
    })
    .mockReturnValueOnce({
      outcome: "ok",
      value: JSON.stringify({
        version: 1,
        discipline: "ACME-2",
        mechanism: "audit",
        clauses: [{ clause: "scratch-files", settings: { module: "scratch-files.ts" } }],
      }),
    }),
  exists: vi.fn(),
  write: vi.fn(),
});

const pathFrom =(request: { readonly entry: PathPort["fromFileUrl"] }): PathPort => ({
  join: vi.fn<PathPort["join"]>().mockReturnValue(RUNNER_PATH),
  joinRepository: vi.fn(),
  relative: vi.fn(),
  directoryOf: vi.fn<PathPort["directoryOf"]>().mockReturnValueOnce("/install/api").mockReturnValueOnce("/install"),
  repositoryDirectoryOf: vi.fn(),
  resolve: vi.fn<PathPort["resolve"]>().mockReturnValue({ outcome: "ok", value: absolutePathSchema.parse("/install") }),
  fromFileUrl: request.entry,
});

const BUILT_ENTRY_PATH = pathFrom({
  entry: vi.fn<PathPort["fromFileUrl"]>().mockReturnValue({ outcome: "ok", value: absolutePathSchema.parse("/install/api/testing.js") }),
});

const NO_RUNNER: ModuleLoaderPort = {
  load: vi.fn<ModuleLoaderPort["load"]>().mockResolvedValue({ outcome: "ok", value: {} }),
};

describe("createConformanceTesting", () => {
  it("loads the built audit runner from the install root two folders above a built entry", async () => {
    const path = pathFrom({
      entry: vi.fn<PathPort["fromFileUrl"]>().mockReturnValue({ outcome: "ok", value: absolutePathSchema.parse("/install/api/testing.js") }),
    });
    const testing = createConformanceTesting({ mechanism: AUDIT, moduleUrl: BUILT_ENTRY_URL, fileText: acmeFileText(), path, modules: NO_RUNNER });
    await testing.clauseConformanceOf({ ruleSetRoot: "acme", clause: "acme/ACME-2#scratch-files" });
    expect(path.join).toHaveBeenLastCalledWith({ segments: ["/install", "src", "infrastructure", "engines", "audit", "runner", "runner.js"] });
  });

  it("refuses every conformance run when the entry's install root cannot be found", async () => {
    const testing = createConformanceTesting({ mechanism: AUDIT,
      moduleUrl: "https://example.invalid/api/testing.js",
      fileText: unreadableFileText(),
      path: pathFrom({
        entry: vi.fn<PathPort["fromFileUrl"]>().mockReturnValue({
          outcome: "failed",
          error: { kind: "not-a-file-url", url: "https://example.invalid/api/testing.js", detail: "the text is not a file: URL" },
        }),
      }),
      modules: NO_RUNNER,
    });
    await expect(testing.clauseConformanceOf({ ruleSetRoot: "acme", clause: "acme/ACME-2#scratch-files" })).resolves.toEqual({
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: "install-root-unresolvable https://example.invalid/api/testing.js the text is not a file: URL",
      },
    });
  });

  it("binds a clause through the given ports", () => {
    const testing = createConformanceTesting({ mechanism: AUDIT,
      moduleUrl: BUILT_ENTRY_URL,
      fileText: unreadableFileText(),
      path: BUILT_ENTRY_PATH,
      modules: NO_RUNNER,
    });
    expect(testing.clauseUnderTestOf({ ruleSetRoot: "acme", clause: "acme/ACME-2#scratch-files" })).toEqual({
      outcome: "failed",
      error: { kind: "rule-set-unloadable", detail: `file-unreadable ${RUNNER_PATH} ENOENT` },
    });
  });

  it("gives repository paths", () => {
    const testing = createConformanceTesting({ mechanism: AUDIT, moduleUrl: BUILT_ENTRY_URL, fileText: unreadableFileText(), path: BUILT_ENTRY_PATH, modules: NO_RUNNER });
    expect(testing.repoPathOf({ file: "src/kept.ts" })).toEqual({ outcome: "ok", value: repoPathSchema.parse("src/kept.ts") });
  });
});
