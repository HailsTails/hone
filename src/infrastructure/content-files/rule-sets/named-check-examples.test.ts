import { describe, expect, it, vi } from "vitest";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { absoluteRootOf } from "../../../domain/repository/absolute-root-of.ts";
import { createNamedCheckExamplesRepository } from "./named-check-examples.ts";

const INSTALL_ROOT = absoluteRootOf("/install");

const PIECE_PATH = "/install/src/infrastructure/engines/walker/rebinding/test-body/piece.json";

const EXAMPLES_PATH = "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body/test-body.examples.json";

const SHARED_ROOT = "/install/src/infrastructure/engines/walker/branch-in-a-test/test-body";

describe("createNamedCheckExamplesRepository", () => {
  it("selects only the requested check's rows from its shared examples", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>().mockReturnValueOnce("present"),
      read: vi.fn<FileTextPort["read"]>()
        .mockReturnValueOnce({ outcome: "ok", value: '{"version":2,"anchor":{"kind":"file"},"settings":{"module":"test-body.ts"},"implementation":{"symptom":"branch-in-a-test","check":"test-body"},"examples":"with-implementation"}' })
        .mockReturnValueOnce({ outcome: "ok", value: '{"flag":[{"check":"branch-in-a-test#test-body","name":"branch","fileName":"test.test.ts","source":"if (value) f();","expectedLines":[1]},{"check":"rebinding#test-body","name":"rebind","fileName":"test.test.ts","source":"let value = 0;","expectedLines":[1]}],"allow":[{"check":"rebinding#test-body","name":"constant","fileName":"test.test.ts","source":"const value = 0;","expectedLines":[]}]}' }),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const path = { join: vi.fn<PathPort["join"]>().mockReturnValueOnce(PIECE_PATH).mockReturnValueOnce(EXAMPLES_PATH).mockReturnValueOnce(SHARED_ROOT) };
    const examples = createNamedCheckExamplesRepository({ fileText, path });

    expect(examples.read({ installRoot: INSTALL_ROOT, check: "rebinding#test-body", engine: "walker" })).toMatchObject({
      outcome: "ok",
      value: {
        piece: { pieceRoot: SHARED_ROOT },
        examples: [
          { name: "rebind", fileName: "test.test.ts", source: "let value = 0;", expectedLines: [1] },
          { name: "constant", fileName: "test.test.ts", source: "const value = 0;", expectedLines: [] },
        ],
      },
    });
    expect(fileText.read).toHaveBeenNthCalledWith(2, { path: EXAMPLES_PATH });
    expect(fileText.exists).toHaveBeenCalledExactlyOnceWith({ path: PIECE_PATH });
  });

  it("refuses an invalid check address before accessing disk", () => {
    const fileText: FileTextPort = {
      exists: vi.fn<FileTextPort["exists"]>(),
      read: vi.fn<FileTextPort["read"]>(),
      write: vi.fn<FileTextPort["write"]>(),
    };
    const examples = createNamedCheckExamplesRepository({ fileText, path: { join: vi.fn<PathPort["join"]>() } });

    expect(examples.read({ installRoot: INSTALL_ROOT, check: "../rebinding#test-body", engine: "walker" })).toEqual({
      outcome: "failed", error: { kind: "unknown-clause", address: "../rebinding#test-body" },
    });
    expect(fileText.read).not.toHaveBeenCalled();
  });
});
