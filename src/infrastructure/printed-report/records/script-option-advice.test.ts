import { describe, expect, it } from "vitest";

import type { ScriptOptionCause } from "../../../domain/runner/runner-result-types.ts";
import { type ScriptOptionAdvice, scriptOptionAdviceOf } from "./script-option-advice.ts";

const UNJUDGED = "so Hone cannot tell what the option does to the files under check";

describe("scriptOptionAdviceOf", () => {
  it.each<{
    readonly name: string;
    readonly cause: ScriptOptionCause;
    readonly advice: ScriptOptionAdvice;
  }>([
    {
      name: "an option that weakens the whole run",
      cause: { kind: "weakens-run" },
      advice: {
        problem: "weakens the script's whole run, so no record can cover it",
        fix: "remove it from the script",
      },
    },
    {
      name: "a command that is not the first of its script",
      cause: {
        kind: "after-another-command",
        command: "eslint",
        invocation: "eslint --rule x:off .",
      },
      advice: {
        problem: `eslint is not the first command of its script, ${UNJUDGED}`,
        fix: 'give eslint a script of its own, such as "eslint --rule x:off ."',
      },
    },
    {
      name: "a command behind a wrapper that is neither a package runner nor a setting",
      cause: { kind: "wrapped", command: "biome", wrapper: "env" },
      advice: {
        problem: `"env" comes before biome and is neither a package runner nor a NAME=value setting, ${UNJUDGED}`,
        fix: "put only package runners and NAME=value settings before biome",
      },
    },
    {
      name: "a value the shell supplies",
      cause: { kind: "shell-supplied", command: "eslint", value: "$CONFIG" },
      advice: {
        problem: `the script gives eslint "$CONFIG", whose value is not known until the shell runs, ${UNJUDGED}`,
        fix: "write the value literally in the script",
      },
    },
    {
      name: "a script holding a quote with no partner",
      cause: { kind: "unreadable", command: "eslint" },
      advice: {
        problem: `a quote in the script has no partner, so Hone cannot read what the script passes to eslint or tell what that does to the files under check`,
        fix: "pair every quote in the script",
      },
    },
  ])("gives, for $name, the problem and the fix", ({ cause, advice }) => {
    expect(scriptOptionAdviceOf({ cause })).toEqual(advice);
  });
});
