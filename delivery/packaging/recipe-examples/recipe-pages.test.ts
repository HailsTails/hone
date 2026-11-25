import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import { readRecipePages } from "./recipe-pages.ts";

describe("readRecipePages", () => {
  it("reads each recipe's page, beside the examples the recipe declares", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "ok",
      value: "## Examples\n\n### A let\n```ts\nlet a = 1;\n```\n",
    });
    const join = vi.fn<PathPort["join"]>().mockReturnValue("/repo/stub.md");

    const pages = readRecipePages({
      recipes: [
        {
          name: "stub-with-vi-fn",
          examples: [
            {
              anchor: "a-let",
              answers: [
                {
                  check: { name: "test-body", symptom: { ruleSet: "hone", name: "rebinding" } },
                  form: "a-let",
                },
              ],
            },
          ],
        },
      ],
      ruleSetRoot: "/repo",
      fileText: { read },
      path: { join },
    });

    expect(pages).toEqual([
      {
        kind: "read",
        recipe: "stub-with-vi-fn",
        declared: [
          {
            anchor: "a-let",
            answers: [
              {
                check: { name: "test-body", symptom: { ruleSet: "hone", name: "rebinding" } },
                form: "a-let",
              },
            ],
          },
        ],
        shown: [{ anchor: "a-let", before: "let a = 1;\n", after: [] }],
      },
    ]);
    expect(join).toHaveBeenCalledExactlyOnceWith({
      segments: ["/repo", "rules", "typescript/recipes/stub-with-vi-fn.md"],
    });
    expect(read).toHaveBeenCalledExactlyOnceWith({ path: "/repo/stub.md" });
  });

  it("holds a page it cannot read as unreadable, with the reason", () => {
    const read = vi.fn<FileTextPort["read"]>().mockReturnValue({
      outcome: "failed",
      error: { kind: "unreadable", path: "/repo/stub.md", detail: "EACCES" },
    });
    const join = vi.fn<PathPort["join"]>().mockReturnValue("/repo/stub.md");

    const pages = readRecipePages({
      recipes: [{ name: "stub-with-vi-fn" }],
      ruleSetRoot: "/repo",
      fileText: { read },
      path: { join },
    });

    expect(pages).toEqual([{ kind: "unreadable", recipe: "stub-with-vi-fn", detail: "EACCES" }]);
  });
});
