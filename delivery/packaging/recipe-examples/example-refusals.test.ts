import { describe, expect, it, vi } from "vitest";

import { TOOL_RULE_SET } from "../../../src/domain/rule-set/clause-address.ts";
import type { BlockFlagsPort, FlaggedFormsPort, TypeErrorsPort } from "./block-verdicts-port.ts";
import { type ExampleRefusal, findExampleRefusals } from "./example-refusals.ts";
import type { RecipePage } from "./recipe-pages.ts";

const REBINDING_TEST_BODY = {
  name: "test-body",
  symptom: { ruleSet: TOOL_RULE_SET, name: "rebinding" },
  forms: ["a-let"],
};

const STUB_PAGE: RecipePage = {
  kind: "read",
  recipe: "stub-with-vi-fn",
  declared: [{ anchor: "a-let", answers: [{ check: REBINDING_TEST_BODY, form: "a-let" }] }],
  shown: [
    {
      anchor: "a-let",
      before: "let a = 1;\n",
      after: ["const a = 1;\n", "const [a] = [1];\n"],
    },
  ],
};

type StructureRow = {
  readonly name: string;
  readonly pages: readonly RecipePage[];
  readonly refusals: readonly ExampleRefusal[];
};

describe("findExampleRefusals", () => {
  it("refuses nothing where each form has an example whose before block is flagged with it and whose after blocks pass, and asks about each block", async () => {
    const typeErrors = { read: vi.fn<TypeErrorsPort["read"]>().mockReturnValue([]) };
    const flags = {
      read: vi.fn<BlockFlagsPort["read"]>().mockResolvedValue({ outcome: "ok", value: [] }),
    };
    const flaggedForms = {
      read: vi
        .fn<FlaggedFormsPort["read"]>()
        .mockResolvedValue({ outcome: "ok", value: ["a-let"] }),
    };
    const blocks = [
      { recipe: "stub-with-vi-fn", anchor: "a-let", position: 1, source: "const a = 1;\n" },
      { recipe: "stub-with-vi-fn", anchor: "a-let", position: 2, source: "const [a] = [1];\n" },
    ];

    const refusals = await findExampleRefusals({
      checks: [REBINDING_TEST_BODY],
      pages: [STUB_PAGE],
      typeErrors,
      flags,
      flaggedForms,
    });

    expect(refusals).toEqual([]);
    expect(typeErrors.read).toHaveBeenCalledExactlyOnceWith({ blocks });
    expect(flags.read).toHaveBeenCalledExactlyOnceWith({ blocks });
    expect(flaggedForms.read).toHaveBeenCalledExactlyOnceWith({
      source: "let a = 1;\n",
      check: "rebinding#test-body",
    });
  });

  it.each<StructureRow>([
    {
      name: "a page it could not read, and the form left without an example",
      pages: [{ kind: "unreadable", recipe: "stub-with-vi-fn", detail: "EACCES" }],
      refusals: [
        { kind: "page-unreadable", recipe: "stub-with-vi-fn", detail: "EACCES" },
        { kind: "form-without-an-example", check: "rebinding#test-body", form: "a-let" },
      ],
    },
    {
      name: "an example answering a form its check does not declare",
      pages: [
        STUB_PAGE,
        {
          kind: "read",
          recipe: "assert-to-narrow",
          declared: [{ anchor: "a-var", answers: [{ check: REBINDING_TEST_BODY, form: "a-var" }] }],
          shown: [{ anchor: "a-var", before: "var a = 1;\n", after: ["const a = 1;\n"] }],
        },
      ],
      refusals: [
        {
          kind: "example-answers-no-form",
          recipe: "assert-to-narrow",
          anchor: "a-var",
          check: "rebinding#test-body",
          form: "a-var",
        },
        {
          kind: "flagged-form-not-named",
          recipe: "assert-to-narrow",
          anchor: "a-var",
          check: "rebinding#test-body",
          form: "a-var",
          named: ["a-let"],
        },
      ],
    },
    {
      name: "a declared example its page does not show, and a shown one it does not declare",
      pages: [
        {
          kind: "read",
          recipe: "stub-with-vi-fn",
          declared: [{ anchor: "a-let", answers: [{ check: REBINDING_TEST_BODY, form: "a-let" }] }],
          shown: [{ anchor: "a-const", before: "const a = 1;\n", after: ["const b = 1;\n"] }],
        },
      ],
      refusals: [
        { kind: "example-missing-on-page", recipe: "stub-with-vi-fn", anchor: "a-let" },
        { kind: "page-example-not-declared", recipe: "stub-with-vi-fn", anchor: "a-const" },
      ],
    },
    {
      name: "an example with no block",
      pages: [
        {
          kind: "read",
          recipe: "stub-with-vi-fn",
          declared: [{ anchor: "a-let", answers: [{ check: REBINDING_TEST_BODY, form: "a-let" }] }],
          shown: [{ anchor: "a-let", before: undefined, after: [] }],
        },
      ],
      refusals: [
        { kind: "example-without-before-block", recipe: "stub-with-vi-fn", anchor: "a-let" },
      ],
    },
    {
      name: "an example with nothing after its before block",
      pages: [
        {
          kind: "read",
          recipe: "stub-with-vi-fn",
          declared: [{ anchor: "a-let", answers: [{ check: REBINDING_TEST_BODY, form: "a-let" }] }],
          shown: [{ anchor: "a-let", before: "let a = 1;\n", after: [] }],
        },
      ],
      refusals: [
        { kind: "example-without-after-block", recipe: "stub-with-vi-fn", anchor: "a-let" },
      ],
    },
  ])("refuses $name", async ({ pages, refusals }) => {
    const found = await findExampleRefusals({
      checks: [REBINDING_TEST_BODY],
      pages,
      typeErrors: { read: vi.fn<TypeErrorsPort["read"]>().mockReturnValue([]) },
      flags: {
        read: vi.fn<BlockFlagsPort["read"]>().mockResolvedValue({ outcome: "ok", value: [] }),
      },
      flaggedForms: {
        read: vi
          .fn<FlaggedFormsPort["read"]>()
          .mockResolvedValue({ outcome: "ok", value: ["a-let"] }),
      },
    });

    expect(found).toEqual(refusals);
  });

  it("refuses an after block that does not compile or that a check flags, a diagnostic outside the blocks, and a before block flagged with another form", async () => {
    const block = {
      recipe: "stub-with-vi-fn",
      anchor: "a-let",
      position: 2,
      source: "const [a] = [1];\n",
    };

    const refusals = await findExampleRefusals({
      checks: [REBINDING_TEST_BODY],
      pages: [STUB_PAGE],
      typeErrors: {
        read: vi.fn<TypeErrorsPort["read"]>().mockReturnValue([
          { kind: "in-a-block", block, message: "Object is possibly 'undefined'." },
          { kind: "outside-the-blocks", message: "option 'strict' is invalid" },
        ]),
      },
      flags: {
        read: vi.fn<BlockFlagsPort["read"]>().mockResolvedValue({
          outcome: "ok",
          value: [{ block, check: "loop-keyword#loop-statement", lines: [2] }],
        }),
      },
      flaggedForms: {
        read: vi
          .fn<FlaggedFormsPort["read"]>()
          .mockResolvedValue({ outcome: "ok", value: ["a-ternary"] }),
      },
    });

    expect(refusals).toEqual([
      {
        kind: "after-block-does-not-compile",
        recipe: "stub-with-vi-fn",
        anchor: "a-let",
        position: 2,
        message: "Object is possibly 'undefined'.",
      },
      { kind: "diagnostic-outside-the-blocks", message: "option 'strict' is invalid" },
      {
        kind: "after-block-flagged",
        recipe: "stub-with-vi-fn",
        anchor: "a-let",
        position: 2,
        check: "loop-keyword#loop-statement",
        lines: [2],
      },
      {
        kind: "flagged-form-not-named",
        recipe: "stub-with-vi-fn",
        anchor: "a-let",
        check: "rebinding#test-body",
        form: "a-let",
        named: ["a-ternary"],
      },
    ]);
  });

  it("refuses with each engine's failure when the checks cannot run", async () => {
    const refusals = await findExampleRefusals({
      checks: [REBINDING_TEST_BODY],
      pages: [STUB_PAGE],
      typeErrors: { read: vi.fn<TypeErrorsPort["read"]>().mockReturnValue([]) },
      flags: {
        read: vi
          .fn<BlockFlagsPort["read"]>()
          .mockResolvedValue({ outcome: "failed", error: "eslint did not load" }),
      },
      flaggedForms: {
        read: vi
          .fn<FlaggedFormsPort["read"]>()
          .mockResolvedValue({ outcome: "failed", error: "the walker did not load" }),
      },
    });

    expect(refusals).toEqual([
      { kind: "verdicts-failed", detail: "eslint did not load" },
      { kind: "verdicts-failed", detail: "the walker did not load" },
    ]);
  });
});
