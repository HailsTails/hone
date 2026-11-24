import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import { createPathPort } from "../../../src/infrastructure/node/path-port.ts";
import { readCheckBindings } from "./check-bindings.ts";

const PATH = createPathPort({ flavour: "posix", workingDirectory: () => "/repo" });

describe("readCheckBindings", () => {
  it("binds each check at each edition its piece declares, with the forms the piece declares", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value:
        '{ "version": 2, "anchor": { "kind": "file" }, "settings": { "module": "lets.ts" }, "editions": ["1", "2"], "forms": { "a-let": { "symptom": "rebinding", "check": "test-body" } } }',
    });
    const exists = vi.fn<FileTextPort["exists"]>().mockReturnValue("present");
    const binding = {
      address: "rebinding#test-body",
      ruleSet: "hone",
      engine: "walker",
      settings: { module: "lets.ts" },
      pieceRoot: "/repo/src/infrastructure/engines/walker/rebinding/test-body",
      anchor: { kind: "file" },
      checkSettings: {},
      forms: { "a-let": "rebinding#test-body" },
    };

    const bindings = readCheckBindings({
      checks: [
        { name: "test-body", symptom: { name: "rebinding" }, engines: [{ name: "walker" }] },
      ],
      repoRoot: "/repo",
      fileText: { read, exists },
      path: PATH,
    });

    expect(bindings).toEqual({
      outcome: "ok",
      value: [
        { ...binding, edition: "1" },
        { ...binding, edition: "2" },
      ],
    });
  });

  it("fails naming the check and engine whose piece is missing", () => {
    const bindings = readCheckBindings({
      checks: [
        { name: "test-body", symptom: { name: "rebinding" }, engines: [{ name: "eslint" }] },
      ],
      repoRoot: "/repo",
      fileText: {
        read: vi.fn<FileTextPort["read"]>(),
        exists: vi.fn<FileTextPort["exists"]>().mockReturnValue("absent"),
      },
      path: PATH,
    });

    expect(bindings).toEqual({
      outcome: "failed",
      error: "rebinding#test-body on eslint: piece-missing",
    });
  });
});
