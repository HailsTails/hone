import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { createNamedCheckExamplesRepository } from "./named-check-examples.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const PIECE_PATH = "/install/src/infrastructure/engines/walker/rebinding/test-body/piece.json";

const EXAMPLES_PATH =
  "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/test-body.examples.json";

const SHARED_ROOT = "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body";

const OWNER_PATH =
  "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/piece.json";

const OWNER_DECLARATION =
  '{"version":2,"anchor":{"kind":"file"},"settings":{"module":"test-body.ts"},"forms":{"a-let":{"symptom":"rebinding","check":"test-body"}}}';

describe("createNamedCheckExamplesRepository", () => {
  it("selects only the requested check's rows from its shared examples", () => {
    const fileText: FileTextPort = {
      exists: vi
        .fn<FileTextPort["exists"]>()
        .mockReturnValueOnce("present")
        .mockReturnValueOnce("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{"version":2,"implementation":{"symptom":"branch-in-a-test","check":"test-body"},"examples":"with-implementation"}',
        })
        .mockReturnValueOnce({ outcome: "ok", value: OWNER_DECLARATION })
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{"flag":[{"check":"branch-in-a-test#test-body","name":"branch","fileName":"test.test.ts","source":"if (value) f();","expectedLines":[1]},{"check":"rebinding#test-body","name":"rebind","fileName":"test.test.ts","source":"let value = 0;","expectedLines":[1]}],"allow":[{"check":"rebinding#test-body","name":"constant","fileName":"test.test.ts","source":"const value = 0;","expectedLines":[]}]}',
        }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const path = {
      join: vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce(PIECE_PATH)
        .mockReturnValueOnce(OWNER_PATH)
        .mockReturnValueOnce(EXAMPLES_PATH)
        .mockReturnValueOnce(SHARED_ROOT),
    };
    const examples = createNamedCheckExamplesRepository({ fileText, path });

    expect(
      examples.read({
        installRoot: INSTALL_ROOT,
        ruleSetRoot: INSTALL_ROOT,
        check: "rebinding#test-body",
        engine: "walker",
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        piece: { pieceRoot: SHARED_ROOT },
        examples: [
          {
            name: "rebind",
            fileName: "test.test.ts",
            source: "let value = 0;",
            expectedLines: [1],
          },
          {
            name: "constant",
            fileName: "test.test.ts",
            source: "const value = 0;",
            expectedLines: [],
          },
        ],
      },
    });
    expect(fileText.read).toHaveBeenNthCalledWith(3, { path: EXAMPLES_PATH });
    expect(fileText.exists).toHaveBeenNthCalledWith(1, { path: PIECE_PATH });
    expect(fileText.exists).toHaveBeenNthCalledWith(2, { path: OWNER_PATH });
  });

  it.each([
    {
      name: "a shared example without a tag",
      document:
        '{"flag":[{"name":"branch","fileName":"test.test.ts","source":"if (value) f();","expectedLines":[1]}],"allow":[]}',
      detail: "shared example branch requires a check tag",
    },
    {
      name: "a tag naming an unknown check",
      document:
        '{"flag":[{"check":"rebinding#mistyped","name":"rebind","fileName":"test.test.ts","source":"let value = 0;","expectedLines":[1]}],"allow":[]}',
      detail: "example rebind names unknown check rebinding#mistyped",
    },
  ])("refuses $name", ({ document, detail }) => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: OWNER_DECLARATION })
        .mockReturnValueOnce({ outcome: "ok", value: document }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const path = {
      join: vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce(OWNER_PATH)
        .mockReturnValueOnce(EXAMPLES_PATH)
        .mockReturnValueOnce(SHARED_ROOT),
    };
    const examples = createNamedCheckExamplesRepository({ fileText, path });
    expect(
      examples.read({
        installRoot: INSTALL_ROOT,
        ruleSetRoot: INSTALL_ROOT,
        check: "branch-in-a-test#test-body",
        engine: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "file-malformed", path: EXAMPLES_PATH, detail },
    });
  });

  it("reads a team's check from the engines folder under its rule set root", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: '{"version":2,"anchor":{"kind":"file"},"settings":{"module":"scratch-files.ts"}}',
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{"flag":[{"name":"scratch","fileName":"src/a.scratch.ts","source":"","expectedLines":[1]}],"allow":[{"name":"kept","fileName":"src/a.ts","source":"","expectedLines":[]}]}',
        }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const path = {
      join: vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce("/repo/acme/engines/walker/scratch-file/scratch-files/piece.json")
        .mockReturnValueOnce(
          "/repo/acme/engines/walker/scratch-file/scratch-files/scratch-files.examples.json",
        )
        .mockReturnValueOnce("/repo/acme/engines/walker/scratch-file/scratch-files"),
    };
    const examples = createNamedCheckExamplesRepository({ fileText, path });

    examples.read({
      installRoot: INSTALL_ROOT,
      ruleSetRoot: absoluteRootOf("/repo/acme"),
      check: "scratch-file#scratch-files",
      engine: "walker",
    });

    expect(path.join).toHaveBeenNthCalledWith(1, {
      segments: ["/repo/acme", "engines", "walker", "scratch-file", "scratch-files", "piece.json"],
    });
  });

  it("refuses an invalid check address before accessing disk", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>(),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const examples = createNamedCheckExamplesRepository({
      fileText,
      path: { join: vi.fn<PathPort["join"]>() },
    });

    expect(
      examples.read({
        installRoot: INSTALL_ROOT,
        ruleSetRoot: INSTALL_ROOT,
        check: "../rebinding#test-body",
        engine: "walker",
      }),
    ).toEqual({
      outcome: "failed",
      error: { kind: "unknown-clause", address: "../rebinding#test-body" },
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });
});
