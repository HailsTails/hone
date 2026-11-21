import { describe, expect, it, vi } from "vitest";
import type { ProcessPort } from "../../src/infrastructure/node/process/process-port.ts";
import { runPullRequestTitleCheck } from "./pull-request-title.ts";

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

const outputOf = (request: { readonly process: ProcessPort }) => ({
  writes: vi.mocked(request.process.writeOut).mock.calls,
  errors: vi.mocked(request.process.writeError).mock.calls,
  exits: vi.mocked(request.process.exitWith).mock.calls,
});

const EXPECTED_FORM =
  "A pull request title is its squash commit's subject on main, so it must read type(scope)!: description, with an optional lowercase scope, ! only for a breaking change, and type one of feat, fix, perf, revert, docs, refactor, test, build, ci, chore, style.\n";

describe("runPullRequestTitleCheck", () => {
  it("passes a conventional title and says what it reads", () => {
    const processPort = processWith({ arguments: ["feat(release)!: prepare release pull requests"] });

    runPullRequestTitleCheck({ process: processPort });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "pull request title: feat, release scope, breaking\n" }]],
      errors: [],
      exits: [[{ code: 0 }]],
    });
  });

  it("passes a title without a scope as compatible", () => {
    const processPort = processWith({ arguments: ["docs: write the compatibility policy"] });

    runPullRequestTitleCheck({ process: processPort });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [[{ text: "pull request title: docs, no scope, compatible\n" }]],
      errors: [],
      exits: [[{ code: 0 }]],
    });
  });

  it("fails a title that is not shaped as a conventional subject", () => {
    const processPort = processWith({ arguments: ["Keep versions out of the docs"] });

    runPullRequestTitleCheck({ process: processPort });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: `pull request title "Keep versions out of the docs" is not a conventional commit subject. ${EXPECTED_FORM}` }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("fails a title whose type is not in the list", () => {
    const processPort = processWith({ arguments: ["feature: add a release script"] });

    runPullRequestTitleCheck({ process: processPort });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: `pull request title "feature: add a release script" has the unknown type feature. ${EXPECTED_FORM}` }]],
      exits: [[{ code: 1 }]],
    });
  });

  it.each([[[]], [["feat: one", "feat: two"]]])("exits 2 with its usage when not given exactly one title: %j", (titleArguments) => {
    const processPort = processWith({ arguments: titleArguments });

    runPullRequestTitleCheck({ process: processPort });

    expect(outputOf({ process: processPort })).toEqual({
      writes: [],
      errors: [[{ text: "usage: pull-request-title <title>\n" }]],
      exits: [[{ code: 2 }]],
    });
  });
});
