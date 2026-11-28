import { describe, expect, it, vi } from "vitest";

import { type Diagnose, createTypeErrorsPort } from "./block-type-errors.ts";

describe("createTypeErrorsPort", () => {
  it("diagnoses each block as its own file under the slashed root, and names the block a diagnostic is in", () => {
    const first = {
      recipe: "assert-to-narrow",
      anchor: "an-index",
      position: 1,
      source: "expect(1).toBe(1);\n",
    };
    const second = {
      recipe: "assert-to-narrow",
      anchor: "an-option",
      position: 1,
      source: "expect(rows[0].id).toBe(2);\n",
    };
    const diagnose = vi.fn<Diagnose>().mockReturnValue([
      {
        path: "C:/work/repo/recipe-example-1.test.ts",
        message: "Object is possibly 'undefined'.",
      },
    ]);

    const errors = createTypeErrorsPort({ diagnose, repoRoot: "C:\\work\\repo" }).read({
      blocks: [first, second],
    });

    expect(errors).toEqual([
      { kind: "in-a-block", block: second, message: "Object is possibly 'undefined'." },
    ]);
    expect(diagnose).toHaveBeenCalledExactlyOnceWith({
      files: [
        {
          path: "C:/work/repo/recipe-example-0.test.ts",
          text: 'import { assert, expect, it, vi } from "vitest";\nexpect(1).toBe(1);\n',
        },
        {
          path: "C:/work/repo/recipe-example-1.test.ts",
          text: 'import { assert, expect, it, vi } from "vitest";\nexpect(rows[0].id).toBe(2);\n',
        },
      ],
    });
  });
});
