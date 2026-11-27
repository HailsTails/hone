import { describe, expect, it, vi } from "vitest";

import { editionOf } from "../../../src/domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import { type ConformingRunner, createBlockFlagsPort } from "./block-flags.ts";

const ANY: CheckBinding = {
  address: "untyped-value#explicit-any",
  ruleSet: "hone",
  engine: "eslint",
  edition: editionOf("1"),
  settings: {},
  pieceRoot: "/repo/untyped-value/explicit-any",
  anchor: { kind: "file" },
  checkSettings: {},
};

const ASSERTION_SITE: CheckBinding = {
  ...ANY,
  address: "assertion-outside-a-test-body#assertion-site",
  engine: "walker",
};

const BLOCK = {
  recipe: "assert-to-narrow",
  anchor: "an-any",
  position: 1,
  source: "expect(row).toBe(1);\n",
};

describe("createBlockFlagsPort", () => {
  it("holds each block to each binding on its own engine, inside a test for assertion sites, and lists the flagged lines", async () => {
    const walker = {
      conform: vi.fn<ConformingRunner["conform"]>().mockResolvedValue({
        outcome: "ok",
        value: [{ caseName: "assert-to-narrow#an-any 1", flaggedLines: [] }],
      }),
    };
    const eslint = {
      conform: vi.fn<ConformingRunner["conform"]>().mockResolvedValue({
        outcome: "ok",
        value: [{ caseName: "assert-to-narrow#an-any 1", flaggedLines: [2] }],
      }),
    };

    const flags = await createBlockFlagsPort({
      runners: { walker, eslint, oxlint: { conform: vi.fn<ConformingRunner["conform"]>() } },
    }).read({
      blocks: [BLOCK],
      bindings: [ASSERTION_SITE, ANY],
    });

    expect(flags).toEqual({
      outcome: "ok",
      value: [{ block: BLOCK, check: "untyped-value#explicit-any", lines: [2] }],
    });
    expect(walker.conform).toHaveBeenCalledExactlyOnceWith({
      binding: ASSERTION_SITE,
      cases: [
        {
          name: "assert-to-narrow#an-any 1",
          fileName: "recipe-example.test.ts",
          source:
            'import { assert, expect, it, vi } from "vitest";\nit("example", () => {\nexpect(row).toBe(1);\n\n});',
          expectedLines: [],
        },
      ],
    });
    expect(eslint.conform).toHaveBeenCalledExactlyOnceWith({
      binding: ANY,
      cases: [
        {
          name: "assert-to-narrow#an-any 1",
          fileName: "recipe-example.test.ts",
          source: 'import { assert, expect, it, vi } from "vitest";\nexpect(row).toBe(1);\n',
          expectedLines: [],
        },
      ],
    });
  });

  it("fails naming the check and engine whose runner fails", async () => {
    const eslint = {
      conform: vi.fn<ConformingRunner["conform"]>().mockRejectedValue(new Error("broken")),
    };

    const flags = await createBlockFlagsPort({
      runners: {
        walker: { conform: vi.fn<ConformingRunner["conform"]>() },
        eslint,
        oxlint: { conform: vi.fn<ConformingRunner["conform"]>() },
      },
    }).read({ blocks: [BLOCK], bindings: [ANY] });

    expect(flags).toEqual({
      outcome: "failed",
      error: "untyped-value#explicit-any on eslint: runner-invalid-output",
    });
  });
});
