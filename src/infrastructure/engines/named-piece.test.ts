import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../application/ports/host/path-port.ts";
import { catalogueNameOf } from "../../domain/language-layer/catalogue-name.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import { readNamedPiece } from "./named-piece.ts";

const PIECE_ROOT = "/install/src/infrastructure/engines/walker/ambient-randomness/direct-call";
const EXAMPLES_PATH =
  "/install/src/infrastructure/engines/walker/ambient-randomness/direct-call/direct-call.examples.json";
const PIECE_PATH =
  "/install/src/infrastructure/engines/walker/ambient-randomness/direct-call/piece.json";
const SUBJECT = {
  installRoot: "/install",
  ruleSetRoot: "/install",
  mechanism: "walker" as const,
  symptom: catalogueNameOf("ambient-randomness"),
  check: catalogueNameOf("direct-call"),
};

describe("readNamedPiece", () => {
  it("binds an audit check directly from its named declaration", () => {
    const join = vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce(PIECE_PATH)
      .mockReturnValueOnce(EXAMPLES_PATH)
      .mockReturnValueOnce(PIECE_ROOT);
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value:
        '{"version":2,"anchor":{"kind":"file"},"settings":{"module":"ambient-randomness.ts"},"checkSettings":{"limit":{"default":3}},"editions":["1","2"]}',
    });
    expect(
      readNamedPiece({ ...SUBJECT, path: { join }, fileText: { exists: () => "present", read } }),
    ).toEqual({
      outcome: "ok",
      value: {
        anchor: { kind: "file" },
        exceptions: "allowed",
        settings: { module: "ambient-randomness.ts" },
        declarations: { limit: { default: 3 } },
        editions: {
          declared: [editionOf("1"), editionOf("2")],
          default: editionOf("1"),
          latest: editionOf("2"),
        },
        pieceRoot: PIECE_ROOT,
        declarationPath: PIECE_PATH,
        examplesPath: EXAMPLES_PATH,
        exampleOwner: { symptom: "ambient-randomness", check: "direct-call" },
        forms: {},
      },
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: PIECE_PATH });
  });

  it("uses another engine's examples while keeping this engine's implementation", () => {
    const join = vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce("/install/oxlint/piece.json")
      .mockReturnValueOnce("/install/eslint/direct-call.examples.json")
      .mockReturnValueOnce("/install/oxlint");
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value: '{"version":2,"anchor":{"kind":"file"},"settings":{},"examplesFrom":"eslint"}',
    });

    const piece = readNamedPiece({
      ...SUBJECT,
      mechanism: "oxlint",
      path: { join },
      fileText: { exists: () => "present", read },
    });

    expect(piece).toMatchObject({
      outcome: "ok",
      value: {
        examplesPath: "/install/eslint/direct-call.examples.json",
        pieceRoot: "/install/oxlint",
      },
    });
    expect(join).toHaveBeenNthCalledWith(2, {
      segments: [
        "/install",
        "src",
        "infrastructure",
        "engines",
        "eslint",
        "ambient-randomness",
        "direct-call",
        "direct-call.examples.json",
      ],
    });
  });

  it.each([
    {
      declaration:
        '{"version":2,"implementation":{"symptom":"ambient-randomness","check":"random-call"},"settings":{"operation":"ambient"},"checkSettings":{"limit":{"default":3}}}',
      declared: ["1", "2"],
      latest: "2",
    },
    {
      declaration:
        '{"version":2,"implementation":{"symptom":"ambient-randomness","check":"random-call"},"settings":{"operation":"ambient"},"checkSettings":{"limit":{"default":3}},"editions":["1","3"]}',
      declared: ["1", "3"],
      latest: "3",
    },
  ])(
    "takes shared fields from the implementation and keeps the check's own settings and editions $latest",
    ({ declaration, declared, latest }) => {
      const implementationPath =
        "/install/src/infrastructure/engines/walker/ambient-randomness/random-call/piece.json";
      const implementationRoot =
        "/install/src/infrastructure/engines/walker/ambient-randomness/random-call";
      const join = vi
        .fn<PathPort["join"]>()
        .mockReturnValueOnce(PIECE_PATH)
        .mockReturnValueOnce(implementationPath)
        .mockReturnValueOnce(EXAMPLES_PATH)
        .mockReturnValueOnce(implementationRoot);
      const read = vi
        .fn<FileTextPort["read"]>()
        .mockReturnValueOnce({
          outcome: "ok",
          value: declaration,
        })
        .mockReturnValueOnce({
          outcome: "ok",
          value:
            '{"version":2,"anchor":{"kind":"keyword","keyword":"new"},"settings":{"module":"random-call.ts"},"editions":["1","2"]}',
        });
      expect(
        readNamedPiece({ ...SUBJECT, path: { join }, fileText: { exists: () => "present", read } }),
      ).toMatchObject({
        outcome: "ok",
        value: {
          pieceRoot: implementationRoot,
          anchor: { kind: "keyword", keyword: "new" },
          settings: { module: "random-call.ts", operation: "ambient" },
          editions: { declared, default: "1", latest },
          declarations: { limit: { default: 3 } },
        },
      });
      expect(read).toHaveBeenNthCalledWith(2, { path: implementationPath });
    },
  );

  it("reports a missing implementation at the target declaration path", () => {
    const implementationPath =
      "/install/src/infrastructure/engines/walker/ambient-randomness/random-call/piece.json";
    const join = vi
      .fn<PathPort["join"]>()
      .mockReturnValueOnce(PIECE_PATH)
      .mockReturnValueOnce(implementationPath);
    const exists = vi
      .fn<FileTextPort["exists"]>()
      .mockReturnValueOnce("present")
      .mockReturnValueOnce("absent");
    const read = vi.fn<FileTextPort["read"]>().mockReturnValueOnce({
      outcome: "ok",
      value:
        '{"version":2,"implementation":{"symptom":"ambient-randomness","check":"random-call"}}',
    });
    expect(readNamedPiece({ ...SUBJECT, path: { join }, fileText: { exists, read } })).toEqual({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: implementationPath,
        detail: "referenced implementation is missing",
      },
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: PIECE_PATH });
  });

  it("names the requested check when its declaration is absent", () => {
    const join = vi.fn<PathPort["join"]>().mockReturnValue(PIECE_PATH);
    const read = vi.fn<FileTextPort["read"]>();
    expect(
      readNamedPiece({ ...SUBJECT, path: { join }, fileText: { exists: () => "absent", read } }),
    ).toEqual({
      outcome: "failed",
      error: {
        kind: "piece-missing",
        address: "ambient-randomness#direct-call",
        mechanism: "walker",
      },
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("names the check and path when the declaration is malformed", () => {
    const join = vi.fn<PathPort["join"]>().mockReturnValue(PIECE_PATH);
    const read = vi
      .fn<FileTextPort["read"]>()
      .mockReturnValue({ outcome: "ok", value: '{"version":1}' });
    expect(
      readNamedPiece({ ...SUBJECT, path: { join }, fileText: { exists: () => "present", read } }),
    ).toMatchObject({
      outcome: "failed",
      error: {
        kind: "file-malformed",
        path: PIECE_PATH,
        detail: expect.stringContaining("ambient-randomness#direct-call"),
      },
    });
  });
});
