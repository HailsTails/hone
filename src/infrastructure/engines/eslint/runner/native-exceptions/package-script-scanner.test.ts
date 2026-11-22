import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import { ruleSetNameOf } from "../../../../../domain/rule-set/rule-set-name-of.ts";
import {
  commandLineOptionsOf,
  eslintInvocationsOf,
  type OptionEffect,
  type SelectedRule,
  scanPackageJson,
  type Settlement,
  scriptCommandsOf,
  suppressionsLocationValuesOf,
} from "./package-script-scanner.ts";

const classSyntax = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};
const noTmpFiles = {
  ruleSet: { name: ruleSetNameOf("probe") },
  discipline: disciplineIdOf("PD-1"),
  clause: clauseIdOf("no-tmp-files"),
};
const noClassAuthoring = "hone/no-class-authoring";
const rootPackageJson = repoPathOf("package.json");
const nestedPackageJson = repoPathOf("packages/a/package.json");

const WEAKENS: OptionEffect = { kind: "weakens" };

type OptionRow = {
  readonly options: readonly string[];
  readonly option: string;
  readonly effect: OptionEffect;
};

const classRule: SelectedRule = { ruleId: noClassAuthoring, clause: classSyntax };
const tmpRule: SelectedRule = { ruleId: "probe-lint/no-tmp-files", clause: noTmpFiles };

describe("scriptCommandsOf", () => {
  it("splits a command into tokens on runs of whitespace", () => {
    expect(scriptCommandsOf({ script: "eslint  src\t--max-warnings 0" })).toEqual({
      outcome: "ok",
      value: [["eslint", "src", "--max-warnings", "0"]],
    });
  });

  it("keeps single- and double-quoted spans whole and removes their quotes", () => {
    expect(
      scriptCommandsOf({
        script: `eslint --rule 'hone/no-class-authoring: off' --ignore-pattern "dist/**"`,
      }),
    ).toEqual({
      outcome: "ok",
      value: [["eslint", "--rule", "hone/no-class-authoring: off", "--ignore-pattern", "dist/**"]],
    });
  });

  it("splits commands at &&, ||, ; and | standing alone", () => {
    expect(
      scriptCommandsOf({ script: "tsc && eslint . || echo failed ; echo done | cat" }),
    ).toEqual({
      outcome: "ok",
      value: [["tsc"], ["eslint", "."], ["echo", "failed"], ["echo", "done"], ["cat"]],
    });
  });

  it("does not split at an operator inside quotes", () => {
    expect(scriptCommandsOf({ script: `echo "a && b; c | d" 'e || f'` })).toEqual({
      outcome: "ok",
      value: [["echo", "a && b; c | d", "e || f"]],
    });
  });
});

describe("eslintInvocationsOf", () => {
  it.each([
    { command: ["eslint", "src", "--quiet"], options: ["src", "--quiet"] },
    { command: ["npx", "eslint", "src"], options: ["src"] },
    { command: ["pnpm", "exec", "eslint", "src"], options: ["src"] },
    { command: ["./node_modules/.bin/eslint", "src"], options: ["src"] },
  ])(
    "recognises $command as an invocation whose options follow the eslint token",
    ({ command, options }) => {
      expect(eslintInvocationsOf({ commands: [command] })).toEqual([{ options }]);
    },
  );

  it.each([
    ["eslint-plugin-check", "src"],
    ["prettier", "--check", "eslint.config.mjs"],
  ])("does not recognise %s as an invocation", (...command) => {
    expect(eslintInvocationsOf({ commands: [command] })).toEqual([]);
  });

  it("reads options a package manager forwards after -- the same way", () => {
    expect(
      eslintInvocationsOf({
        commands: [
          ["pnpm", "exec", "eslint", "src", "--", "--rule", "hone/no-class-authoring: off"],
        ],
      }),
    ).toEqual([{ options: ["src", "--rule", "hone/no-class-authoring: off"] }]);
  });

  it("finds each invocation among a script's other commands, counting any command with an eslint token", () => {
    expect(
      eslintInvocationsOf({
        commands: [
          ["cd", "sub"],
          ["eslint", "src"],
          ["echo", "eslint"],
        ],
      }),
    ).toEqual([{ options: ["src"] }, { options: [] }]);
  });
});

describe("commandLineOptionsOf", () => {
  it("reports --rule in space form when its value names a selected rule id", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["src", "--rule", "hone/no-class-authoring: off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      {
        option: "--rule hone/no-class-authoring: off",
        ruleIds: [noClassAuthoring],
        effect: WEAKENS,
      },
    ]);
  });

  it("reports --rule in = form when its value names a selected rule id", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule=hone/no-class-authoring: off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      {
        option: "--rule=hone/no-class-authoring: off",
        ruleIds: [noClassAuthoring],
        effect: WEAKENS,
      },
    ]);
  });

  it("matches a selected rule id after a comma and spaces in the --rule value", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", "no-console: off,   hone/no-class-authoring : off"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([
      {
        option: "--rule no-console: off,   hone/no-class-authoring : off",
        ruleIds: [noClassAuthoring],
        effect: WEAKENS,
      },
    ]);
  });

  it("names only the selected rule ids a --rule value names", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--rule", "probe-lint/no-tmp-files: off"] },
        selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
      }),
    ).toEqual([
      {
        option: "--rule probe-lint/no-tmp-files: off",
        ruleIds: ["probe-lint/no-tmp-files"],
        effect: WEAKENS,
      },
    ]);
  });

  it.each(["hone/no-class-authoring-x: off", "no-console: off", "discipline: off"])(
    "does not report --rule whose value %s names no selected rule id as a whole id",
    (ruleValue) => {
      expect(
        commandLineOptionsOf({
          invocation: { options: ["--rule", ruleValue] },
          selectedRuleIds: [noClassAuthoring],
        }),
      ).toEqual([]);
    },
  );

  it.each([
    [["--suppress-rule", "hone/no-class-authoring"], "--suppress-rule hone/no-class-authoring"],
    [["--suppress-rule=hone/no-class-authoring"], "--suppress-rule=hone/no-class-authoring"],
    [
      ["--suppress-rule", "no-console,hone/no-class-authoring"],
      "--suppress-rule no-console,hone/no-class-authoring",
    ],
  ])("reports %j when it names a selected rule id", (options, option) => {
    expect(
      commandLineOptionsOf({ invocation: { options }, selectedRuleIds: [noClassAuthoring] }),
    ).toEqual([{ option, ruleIds: [noClassAuthoring], effect: WEAKENS }]);
  });

  it("does not report --suppress-rule naming a rule id that only extends a selected one", () => {
    expect(
      commandLineOptionsOf({
        invocation: { options: ["--suppress-rule", "hone/no-class-authoring-x"] },
        selectedRuleIds: [noClassAuthoring],
      }),
    ).toEqual([]);
  });

  it.each<OptionRow>([
    { options: ["--suppress-all"], option: "--suppress-all", effect: WEAKENS },
    {
      options: ["--ignore-pattern", "dist/**"],
      option: "--ignore-pattern dist/**",
      effect: { kind: "ignores-pattern", pattern: "dist/**" },
    },
    {
      options: ["--ignore-pattern=dist/**"],
      option: "--ignore-pattern=dist/**",
      effect: { kind: "ignores-pattern", pattern: "dist/**" },
    },
    {
      options: ["-c", "alt.config.mjs"],
      option: "-c alt.config.mjs",
      effect: { kind: "names-config", config: "alt.config.mjs" },
    },
    {
      options: ["--config", "alt.config.mjs"],
      option: "--config alt.config.mjs",
      effect: { kind: "names-config", config: "alt.config.mjs" },
    },
    {
      options: ["--config=alt.config.mjs"],
      option: "--config=alt.config.mjs",
      effect: { kind: "names-config", config: "alt.config.mjs" },
    },
    { options: ["--no-config-lookup"], option: "--no-config-lookup", effect: WEAKENS },
    { options: ["--parser", "espree"], option: "--parser espree", effect: WEAKENS },
    {
      options: ["--parser-options", "ecmaVersion:2020"],
      option: "--parser-options ecmaVersion:2020",
      effect: WEAKENS,
    },
    { options: ["--plugin", "local"], option: "--plugin local", effect: WEAKENS },
  ])(
    "reports $option for every selected rule id, with the effect it is judged by",
    ({ options, option, effect }) => {
      expect(
        commandLineOptionsOf({
          invocation: { options: ["src", ...options] },
          selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
        }),
      ).toEqual([{ option, ruleIds: [noClassAuthoring, "probe-lint/no-tmp-files"], effect }]);
    },
  );

  it.each<OptionRow>([
    {
      options: ["-c=alt.config.mjs"],
      option: "-c=alt.config.mjs",
      effect: { kind: "names-config", config: "alt.config.mjs" },
    },
    { options: ["--parser=espree"], option: "--parser=espree", effect: WEAKENS },
    {
      options: ["--parser-options=ecmaVersion:2020"],
      option: "--parser-options=ecmaVersion:2020",
      effect: WEAKENS,
    },
    { options: ["--plugin=local"], option: "--plugin=local", effect: WEAKENS },
  ])(
    "reports the = form $option for every selected rule id, with the effect it is judged by",
    ({ options, option, effect }) => {
      expect(
        commandLineOptionsOf({
          invocation: { options },
          selectedRuleIds: [noClassAuthoring, "probe-lint/no-tmp-files"],
        }),
      ).toEqual([{ option, ruleIds: [noClassAuthoring, "probe-lint/no-tmp-files"], effect }]);
    },
  );
});

describe("suppressionsLocationValuesOf", () => {
  it("reads --suppressions-location in space form", () => {
    expect(
      suppressionsLocationValuesOf({
        invocation: { options: ["src", "--suppressions-location", "lint-suppressions.json"] },
      }),
    ).toEqual(["lint-suppressions.json"]);
  });

  it("reads --suppressions-location in = form", () => {
    expect(
      suppressionsLocationValuesOf({
        invocation: { options: ["--suppressions-location=lint-suppressions.json", "src"] },
      }),
    ).toEqual(["lint-suppressions.json"]);
  });

  it("reads nothing from an invocation with no --suppressions-location", () => {
    expect(suppressionsLocationValuesOf({ invocation: { options: ["src", "--quiet"] } })).toEqual(
      [],
    );
  });
});

const SETTLED: Settlement = { kind: "settled" };

const UNRESOLVED: Settlement = { kind: "unresolved" };

const afterAnotherCommand = (invocation: string): Settlement => ({
  kind: "not-plain",
  reason: { kind: "after-another-command", invocation },
});

const wrappedBy = (wrapper: string): Settlement => ({
  kind: "not-plain",
  reason: { kind: "wrapped", wrapper },
});

describe("scanPackageJson, whether the script's own folder settles an option's effect", () => {
  it.each<{ readonly script: string; readonly settlement: Settlement }>([
    { script: "eslint --ignore-pattern 'legacy/**' .", settlement: SETTLED },
    { script: "eslint -c eslint.config.mjs src", settlement: SETTLED },
    { script: "pnpm exec eslint --ignore-pattern 'legacy/**' src", settlement: SETTLED },
    { script: "pnpm exec eslint -c eslint.config.mjs .", settlement: SETTLED },
    { script: "npx eslint --ignore-pattern dist --cache .", settlement: SETTLED },
    { script: "yarn eslint -c eslint.config.mjs .", settlement: SETTLED },
    { script: "npm exec -- eslint -c eslint.config.mjs .", settlement: SETTLED },
    { script: "TIMING=1 eslint -c eslint.config.mjs .", settlement: SETTLED },
    {
      script: "cross-env NODE_OPTIONS=--max-old-space-size=4096 eslint --ignore-pattern dist .",
      settlement: SETTLED,
    },
    {
      script: "pnpm exec cross-env TIMING=1 NODE_ENV=ci eslint -c eslint.config.mjs .",
      settlement: SETTLED,
    },
    {
      script: "tsc && eslint -c eslint.config.mjs .",
      settlement: afterAnotherCommand("eslint -c eslint.config.mjs ."),
    },
    {
      script: "tsc && TIMING=1 eslint -c eslint.config.mjs .",
      settlement: afterAnotherCommand("TIMING=1 eslint -c eslint.config.mjs ."),
    },
    {
      script: "cd src && eslint --ignore-pattern 'legacy/**' .",
      settlement: afterAnotherCommand("eslint --ignore-pattern 'legacy/**' ."),
    },
    {
      script: "(cd src && eslint --ignore-pattern 'legacy/**' .)",
      settlement: afterAnotherCommand("eslint --ignore-pattern 'legacy/**' '.)'"),
    },
    {
      script: "pushd src; eslint --ignore-pattern 'legacy/**' .",
      settlement: afterAnotherCommand("eslint --ignore-pattern 'legacy/**' ."),
    },
    { script: "npx -y eslint --ignore-pattern dist .", settlement: wrappedBy("-y") },
    {
      script: "env --chdir=src eslint --ignore-pattern 'legacy/**' .",
      settlement: wrappedBy("env"),
    },
    { script: "ROOT=$PWD eslint -c eslint.config.mjs .", settlement: wrappedBy("ROOT=$PWD") },
    {
      script: "pnpm -C src exec eslint --ignore-pattern 'legacy/**' .",
      settlement: wrappedBy("-C"),
    },
    {
      script: "npm --prefix=src exec eslint --ignore-pattern 'legacy/**' .",
      settlement: wrappedBy("--prefix=src"),
    },
    {
      script: "pnpm --filter web exec eslint --ignore-pattern 'legacy/**' .",
      settlement: wrappedBy("--filter"),
    },
    {
      script: "cross-env NODE_ENV=$MODE eslint -c eslint.config.mjs .",
      settlement: wrappedBy("NODE_ENV=$MODE"),
    },
    {
      script: "cross-env pnpm exec eslint -c eslint.config.mjs .",
      settlement: wrappedBy("cross-env"),
    },
    { script: "tsc && env eslint -c eslint.config.mjs .", settlement: wrappedBy("env") },
    { script: 'eslint --ignore-pattern "$LEGACY" .', settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern `cat legacy.txt` .", settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern '$LEGACY' .", settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern legacy/** .", settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern 'legacy/**' ..", settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern '../legacy/**' .", settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern 'legacy/**' /repo/src", settlement: UNRESOLVED },
    { script: "eslint --ignore-pattern 'legacy/**' ~/src", settlement: UNRESOLVED },
  ])("marks the option in $script as $settlement.kind", ({ script, settlement }) => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: script } }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({ outcome: "ok", value: { scriptOptions: [{ settlement }] } });
  });
});

describe("scanPackageJson", () => {
  it("reports malformed JSON as tool-failed", () => {
    expect(
      scanPackageJson({ path: rootPackageJson, text: `{ "scripts": `, selectedRules: [classRule] }),
    ).toMatchObject({ outcome: "failed", error: { kind: "tool-failed" } });
  });

  it("finds nothing in a package.json with no scripts", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ name: "app" }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: { scriptOptions: [], suppressionsLocations: [], unreadableScripts: [] },
    });
  });

  it.each([
    { script: "echo don't stop" },
    { script: "echo don\\'t stop" },
    { script: `prettier --write "src` },
  ])("passes over $script, whose quotes do not pair and which names no ESLint", ({ script }) => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { say: script } }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: { scriptOptions: [], suppressionsLocations: [], unreadableScripts: [] },
    });
  });

  it.each([
    { script: "eslint --rule 'x: off", command: "eslint" },
    { script: "tsc && ./node_modules/.bin/eslint 'src", command: "./node_modules/.bin/eslint" },
    { script: `pnpm exec "eslint@9 src`, command: "eslint@9" },
  ])(
    "reports $script, whose quotes do not pair, as unreadable to $command once per selected clause",
    ({ script, command }) => {
      expect(
        scanPackageJson({
          path: rootPackageJson,
          text: JSON.stringify({ scripts: { "lint:strict": script } }),
          selectedRules: [classRule, tmpRule],
        }),
      ).toEqual({
        outcome: "ok",
        value: {
          scriptOptions: [],
          suppressionsLocations: [],
          unreadableScripts: [
            {
              command,
              exceptions: [
                {
                  kind: "command-line-option",
                  clause: classSyntax,
                  location: "package.json",
                  script: "lint:strict",
                  option: script,
                },
                {
                  kind: "command-line-option",
                  clause: noTmpFiles,
                  location: "package.json",
                  script: "lint:strict",
                  option: script,
                },
              ],
            },
          ],
        },
      });
    },
  );

  it("still reads the other scripts of a package.json holding an unreadable one", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: { say: "echo don't stop", lint: "eslint --suppress-all src" },
        }),
        selectedRules: [classRule],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: {
        scriptOptions: [{ effect: WEAKENS, command: "eslint" }],
        suppressionsLocations: [],
        unreadableScripts: [],
      },
    });
  });

  it("reports a dormant --rule turning a selected rule off as a command-line-option at the declaring package.json", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: { lint: "eslint --rule 'hone/no-class-authoring: off' src" },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [
          {
            location: "package.json",
            effect: WEAKENS,
            settlement: SETTLED,
            command: "eslint",
            exceptions: [
              {
                kind: "command-line-option",
                clause: classSyntax,
                location: "package.json",
                script: "lint",
                option: "--rule hone/no-class-authoring: off",
              },
            ],
          },
        ],
        suppressionsLocations: [],
        unreadableScripts: [],
      },
    });
  });

  it("does not report a --rule for a rule id that merely extends a selected one", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: { lint: "eslint --rule 'hone/no-class-authoring-x: off' src" },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: { scriptOptions: [], suppressionsLocations: [], unreadableScripts: [] },
    });
  });

  it("reports an every-clause option once per selected clause", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({ scripts: { lint: "eslint -c alt.config.mjs src" } }),
        selectedRules: [classRule, tmpRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [
          {
            location: "package.json",
            effect: { kind: "names-config", config: "alt.config.mjs" },
            settlement: SETTLED,
            command: "eslint",
            exceptions: [
              {
                kind: "command-line-option",
                clause: classSyntax,
                location: "package.json",
                script: "lint",
                option: "-c alt.config.mjs",
              },
              {
                kind: "command-line-option",
                clause: noTmpFiles,
                location: "package.json",
                script: "lint",
                option: "-c alt.config.mjs",
              },
            ],
          },
        ],
        suppressionsLocations: [],
        unreadableScripts: [],
      },
    });
  });

  it("ignores an option outside a recognised ESLint invocation", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: { format: "prettier --config .prettierrc --ignore-pattern dist ." },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: { scriptOptions: [], suppressionsLocations: [], unreadableScripts: [] },
    });
  });

  it("reads --suppressions-location in space and = forms from a root package.json", () => {
    expect(
      scanPackageJson({
        path: rootPackageJson,
        text: JSON.stringify({
          scripts: {
            lint: "eslint --suppressions-location lint-suppressions.json src",
            "lint:ci": "eslint --suppressions-location=ci/suppressions.json src",
          },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [],
        suppressionsLocations: [
          { location: "lint-suppressions.json", script: "lint" },
          { location: "ci/suppressions.json", script: "lint:ci" },
        ],
        unreadableScripts: [],
      },
    });
  });

  it("resolves a nested script's --suppressions-location ../x against the declaring package.json's directory", () => {
    expect(
      scanPackageJson({
        path: nestedPackageJson,
        text: JSON.stringify({
          scripts: { lint: "eslint --suppressions-location ../x/suppressions.json src" },
        }),
        selectedRules: [classRule],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        scriptOptions: [],
        suppressionsLocations: [{ location: "packages/x/suppressions.json", script: "lint" }],
        unreadableScripts: [],
      },
    });
  });
});
