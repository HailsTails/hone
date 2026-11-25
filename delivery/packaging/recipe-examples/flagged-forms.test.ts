import { describe, expect, it, vi } from "vitest";

import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import { repoPathOf } from "../../../src/domain/repository/repo-path-of.ts";
import { editionOf } from "../../../src/domain/rule-set/edition-of.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import { absolutePathSchema } from "../../../src/infrastructure/content-files/absolute-path.ts";
import type { NamedChecksRunner } from "../../../src/infrastructure/engines/protocol/checks/checks-runner-types.ts";
import { type CreateBlockRunner, createFlaggedFormsPort } from "./flagged-forms.ts";

const REPO = absolutePathSchema.parse("/repo");
const BLOCK = repoPathOf("recipe-example.test.ts");

const NEWEST: CheckBinding = {
  address: "branch-in-a-test#test-body",
  ruleSet: "hone",
  engine: "walker",
  edition: editionOf("10"),
  settings: {},
  pieceRoot: "/repo/branch-in-a-test/test-body",
  anchor: { kind: "file" },
  checkSettings: {},
};

const OLDER: CheckBinding = { ...NEWEST, edition: editionOf("9") };

const OTHER_CHECK: CheckBinding = {
  ...NEWEST,
  address: "rebinding#test-body",
  edition: editionOf("11"),
};

const OTHER_ENGINE: CheckBinding = { ...NEWEST, engine: "eslint", edition: editionOf("12") };

describe("createFlaggedFormsPort", () => {
  it("runs the check's newest walker edition over the block and names the form of each hit that has a remedy", async () => {
    const path = {
      join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/recipe-example.test.ts"),
    };
    const run = vi.fn<NamedChecksRunner["run"]>().mockResolvedValue({
      outcome: "ok",
      value: {
        projection: "none",
        slices: [],
        nestedConfigurations: [],
        unprojectedFolders: [],
        misnamedRuleIds: [],
        hits: [
          {
            check: "branch-in-a-test#test-body",
            file: BLOCK,
            anchor: { line: 2, column: 1 },
            snippet: "if (a)",
            remedy: { form: "branching-with-if", fix: "Write a test for each case." },
          },
          {
            check: "branch-in-a-test#test-body",
            file: BLOCK,
            anchor: { line: 3, column: 1 },
            snippet: "a",
          },
        ],
        nativeExceptions: [],
        measured: [],
      },
    });
    const createRunner = vi.fn<CreateBlockRunner>().mockReturnValue({ run });

    const named = await createFlaggedFormsPort({ createRunner, path, repoRoot: REPO }).read({
      source: "if (a) {}\n",
      check: "branch-in-a-test#test-body",
      bindings: [NEWEST, OLDER, OTHER_CHECK, OTHER_ENGINE],
    });

    expect(named).toEqual({ outcome: "ok", value: ["branching-with-if"] });
    expect(path.join).toHaveBeenCalledExactlyOnceWith({
      segments: ["/repo", "recipe-example.test.ts"],
    });
    expect(createRunner).toHaveBeenCalledExactlyOnceWith({
      blockPath: "/repo/recipe-example.test.ts",
      text: 'import { assert, expect, it, vi } from "vitest";\nif (a) {}\n',
    });
    expect(run).toHaveBeenCalledExactlyOnceWith({
      repoRoot: "/repo",
      installRoot: "/repo",
      files: ["recipe-example.test.ts"],
      trackedPaths: ["recipe-example.test.ts"],
      bindings: [NEWEST],
      answered: [],
      declaredConfigRoots: [],
      declaredConfigLookup: undefined,
      testFiles: { suffixes: ["test", "spec"], folders: [] },
    });
  });

  it("fails with the kind of the walker's failure", async () => {
    const run = vi.fn<NamedChecksRunner["run"]>().mockResolvedValue({
      outcome: "failed",
      error: { kind: "tool-failed", detail: "broken" },
    });
    const path = {
      join: vi.fn<PathPort["join"]>().mockReturnValue("/repo/recipe-example.test.ts"),
    };
    const createRunner = vi.fn<CreateBlockRunner>().mockReturnValue({ run });

    const named = await createFlaggedFormsPort({ createRunner, path, repoRoot: REPO }).read({
      source: "if (a) {}\n",
      check: "branch-in-a-test#test-body",
      bindings: [NEWEST],
    });

    expect(named).toEqual({
      outcome: "failed",
      error: "the walker run failed: tool-failed",
    });
  });
});
