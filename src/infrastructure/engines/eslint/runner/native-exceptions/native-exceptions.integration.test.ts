import { afterAll, assert, describe, expect, it, vi } from "vitest";

import type { ModuleLoaderPort } from "../../../../../application/ports/host/module-loader-port.ts";
import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import type { CheckBinding } from "../../../../../domain/runner/check-binding.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { createDefaultDirectoryTreePort } from "../../../../node/file-system/directory-tree-port.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { readHeldDiscipline } from "../../../../upgrade/version-one-rule-sets/held-discipline.ts";
import { namedCheckConformance } from "../../../protocol/conformance.ts";
import { loadedNamedRunnerOver } from "../../../protocol/engine-run/engine-run.ts";
import { runnerModuleAt } from "../../../protocol/runner-module/runner-module-at.ts";
import {
  toolchainBoundEmbeddedRunner,
  toolchainBoundNamedChecksRunner,
} from "../../../protocol/toolchain/toolchain-bound-runner.ts";
import { namedChecksRunner as walkerRunner } from "../../../walker/runner/runner.ts";
import { createChecksRunner } from "../checks-runner/checks-runner.ts";
import {
  createEslintRunner,
  ESLINT_PROJECTED_KINDS,
} from "../embedded-runner/create-eslint-runner.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../toolchain/eslint-9/eslint-9-engine.ts";
import { createEslintPort } from "../toolchain/eslint-instance.ts";
import { defaultEslintToolchainPeers, loadEslintToolchain } from "../toolchain/eslint-toolchain.ts";

const fileText = createDefaultFileTextPort({});

const fileRemoval = createDefaultFileRemovalPort({});

const modules = createDefaultModuleLoaderPort({});

const path = createDefaultPathPort({});

const directory = createDefaultDirectoryPort({});

const directoryTree = createDefaultDirectoryTreePort({});

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({
  installRoot: `${import.meta.dirname}/../../../../../..`,
  installForm: "source",
});

const ESLINT_10_TOOLCHAIN = loadEslintToolchain({ peers: DEVELOPMENT_PEERS });

const ESLINT_9_TOOLCHAIN = loadEslintToolchain({
  peers: { location: DEVELOPMENT_PEERS.location, modules: eslint9ToolchainModules },
});

const ESLINT_9_PIECE_MODULES = eslint9PieceModules({ base: modules });

const LINES = [
  {
    line: "eslint-10",
    eslintVersion: /^10\./,
    toolchain: ESLINT_10_TOOLCHAIN,
    eslintModule: DEVELOPMENT_PEERS.modules.eslint,
    embeddedRunner: toolchainBoundEmbeddedRunner({
      toolchain: ESLINT_10_TOOLCHAIN,
      projectedKinds: ESLINT_PROJECTED_KINDS,
      runnerOf: (toolchain) =>
        createEslintRunner({
          fileText,
          fileRemoval,
          modules,
          path,
          eslint: createEslintPort({ toolchain }),
          moduleExtension: ".ts",
        }),
    }),
    namedRunner: toolchainBoundNamedChecksRunner({
      toolchain: ESLINT_10_TOOLCHAIN,
      fileScope: "typescript",
      projectedKinds: ESLINT_PROJECTED_KINDS,
      runnerOf: (toolchain) =>
        createChecksRunner({
          fileText,
          fileRemoval,
          modules,
          path,
          eslint: createEslintPort({ toolchain }),
          moduleExtension: ".ts",
        }),
    }),
  },
  {
    line: "eslint-9",
    eslintVersion: /^9\./,
    toolchain: ESLINT_9_TOOLCHAIN,
    eslintModule: eslint9ToolchainModules.eslint,
    embeddedRunner: toolchainBoundEmbeddedRunner({
      toolchain: ESLINT_9_TOOLCHAIN,
      projectedKinds: ESLINT_PROJECTED_KINDS,
      runnerOf: (toolchain) =>
        createEslintRunner({
          fileText,
          fileRemoval,
          modules: ESLINT_9_PIECE_MODULES,
          path,
          eslint: createEslintPort({ toolchain }),
          moduleExtension: ".ts",
        }),
    }),
    namedRunner: toolchainBoundNamedChecksRunner({
      toolchain: ESLINT_9_TOOLCHAIN,
      fileScope: "typescript",
      projectedKinds: ESLINT_PROJECTED_KINDS,
      runnerOf: (toolchain) =>
        createChecksRunner({
          fileText,
          fileRemoval,
          modules: ESLINT_9_PIECE_MODULES,
          path,
          eslint: createEslintPort({ toolchain }),
          moduleExtension: ".ts",
        }),
    }),
  },
];

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../../../../../..`);

const SCRATCH = absolutePathSchema.parse(
  path.join({ segments: [INSTALL_ROOT, "artefacts", "native-exceptions"] }),
);

afterAll(() => {
  directoryTree.remove({ path: SCRATCH });
});

const DONE = { outcome: "ok", value: undefined };

const CLAUSE = {
  ruleSet: TOOL_RULE_SET,
  discipline: disciplineIdOf("CD-14"),
  clause: clauseIdOf("class-syntax"),
};

const CLASS_SYNTAX = { ruleSet: TOOL_RULE_SET, discipline: "CD-14", clause: "class-syntax" };

const ESLINT_CLAUSE: RunnerClause = {
  address: CLAUSE,
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword`,
  clauseSettings: {},
  edition: FIRST_EDITION,
  settings: {
    pluginNamespace: "hone",
    pluginModule: "eslint-plugin.ts",
    rule: "no-class-authoring",
  },
};

const WALKER_BINDING: CheckBinding = {
  address: "authored-class-or-this#class-keyword",
  ruleSet: TOOL_RULE_SET,
  engine: "walker",
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/walker/authored-class-or-this/class-keyword`,
  checkSettings: {},
  edition: FIRST_EDITION,
  settings: { module: "class-syntax.ts" },
};

const ESLINT_CLASS_BINDING: CheckBinding = {
  address: "authored-class-or-this#class-keyword",
  ruleSet: TOOL_RULE_SET,
  engine: "eslint",
  anchor: { kind: "keyword", keyword: "class" },
  pieceRoot: `${INSTALL_ROOT}/src/infrastructure/engines/eslint/authored-class-or-this/class-keyword`,
  edition: FIRST_EDITION,
  checkSettings: {},
  settings: {
    pluginNamespace: "hone",
    pluginModule: "eslint-plugin.ts",
    rule: "no-class-authoring",
  },
};

const VERSION_ONE_CAUSAL_WHY_CHAIN: VersionOneWhyChain = {
  whys: [
    {
      why: "Why does the audit refuse tracker ids in carve-out names?",
      because:
        "The audit's name matcher accepts only lowercase slugs, and tracker ids carry uppercase letters.",
      evidence: "tools/audit/name-matcher.ts:14",
    },
    {
      why: "Why does the name matcher accept only lowercase slugs?",
      because:
        "It was copied from the branch-name validator, which lowercases because git refs fold case on Windows.",
      evidence: "tools/git/branch-name.ts:8",
    },
    {
      why: "Why was the matcher copied from the branch-name validator?",
      because:
        "No shared slug type existed when the audit landed, so each tool wrote its own pattern.",
      evidence: "PR #212, merged 2026-07-02",
    },
    {
      why: "Why did no shared slug type exist when the audit landed?",
      because:
        "The values package that now holds RepoPath was split out two months after the audit.",
      evidence: "packages/values/package.json:3",
    },
    {
      why: "Why was the values package split out after the audit?",
      because:
        "The split waited on the monorepo move, which left older tools on their own patterns.",
      evidence: "docs/decisions/0007-monorepo.md:21",
    },
  ],
  rootCause:
    "Older tools still carry patterns written before the monorepo move gave them shared value types.",
  rootCheck:
    "`git grep -n slugPattern tools/` today still returns tools/audit/name-matcher.ts:14 and no import from packages/values.",
  readback:
    "Older tools still carry pre-monorepo patterns, therefore the audit never adopted the shared slug type, therefore its matcher copied the branch-name validator's lowercase rule, therefore the audit refuses tracker ids in carve-out names.",
  owner: "capture 01a0b421",
};

const OWNED_AUTHORISED_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLAUSE,
  mechanism: "eslint",
  file: repoPathOf("src/owned.ts"),
  reason: "wrapping factory for a library construction",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional native unit fixture; not historical authorisation",
  },
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const ROUTE_AUTHORISED_LOCATION: ExceptionRecord = {
  kind: "authorised-location",
  clause: CLAUSE,
  mechanism: "eslint",
  file: repoPathOf("route/[id].ts"),
  reason: "wrapping factory for a library construction",
  provenance: {
    kind: "existing-authorisation",
    source: "fictional native unit fixture route-brackets; not historical authorisation",
  },
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const PACKAGE_LEGACY_CARVE_OUT: ExceptionRecord = {
  kind: "file-carve-out",
  clause: CLAUSE,
  mechanism: "eslint",
  file: repoPathOf("packages/a/legacy.ts"),
  reason: "Inherited class awaiting paydown",
  whyChain: VERSION_ONE_CAUSAL_WHY_CHAIN,
};

const SETTINGS = `{
  "version": 1,
  "ruleSets": {},
  "clauses": {
    "CD-14#class-syntax": "eslint"
  }
}
`;

const PROJECTION = `import piece0 from "../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

const HAND_EDITED_PROJECTION = `import piece0 from "../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone-edited",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

const OWNED_PROJECTION = `import piece0 from "../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "src/owned.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const ROUTE_PROJECTION = `import piece0 from "../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "route/\\\\[id\\\\].ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const PACKAGE_LEGACY_ROOT_PROJECTION = `import piece0 from "../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "packages/a/legacy.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const PACKAGE_LEGACY_SLICE = `import piece0 from "../../../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  {
    name: "hone-core/piece/hone",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "hone": piece0 },
    rules: { "hone/no-class-authoring": "error" },
  },
  {
    name: "hone-core/file-records/CD-14#class-syntax",
    files: [
      "legacy.ts",
    ],
    rules: { "hone/no-class-authoring": "off" },
  },
];
`;

const PROJECTED_CONFIG = `import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
];
`;

const OVERRIDE_AFTER_CONFIG = `import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { files: ["x.ts"], rules: { "hone/no-class-authoring": "off" } },
];
`;

const GLOBAL_IGNORE_CONFIG = `import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  { ignores: ["gen/**", "nothing-here/**"] },
  ...projection,
];
`;

const SEVERITY_ZERO_CONFIG = `import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { rules: { "hone/no-class-authoring": "off" } },
];
`;

const RE_ENABLED_CONFIG = `import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
  { files: ["src/owned.ts"], rules: { "hone/no-class-authoring": "error" } },
];
`;

const FRAGMENT_CONFIG = `import plugin from "../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  {
    plugins: { "hone": plugin },
    rules: { "hone/no-class-authoring": "error" },
  },
];
`;

const UNPROJECTED_CONFIG = `export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
];
`;

const BARE_CONFIG = `export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];
`;

const SPREAD_SLICE_CONFIG = `import projection from "./disciplines.eslint.mjs";

export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];
`;

const KEPT_CLASS = "export class Kept {}\n";

const PLAIN = "export const plain = 1;\n";

const DEFAULT_SUPPRESSIONS = `{
  "supp/a.ts": {
    "hone/no-class-authoring": {
      "count": 1
    }
  }
}
`;

const SCRIPTED_SUPPRESSIONS = `{
  "supp/b.ts": {
    "hone/no-class-authoring": {
      "count": 1
    }
  }
}
`;

const DORMANT_SUPPRESSIONS = `{
  "supp/clean.ts": {
    "hone/no-class-authoring": {
      "count": 1
    }
  }
}
`;

const NESTED_SUPPRESSIONS = `{
  "src/n.ts": {
    "hone/no-class-authoring": {
      "count": 1
    }
  }
}
`;

const SUPPRESSION_SCRIPTS = `{
  "name": "consumer",
  "scripts": {
    "lint": "eslint --suppressions-location custom/supp.json .",
    "lint2": "eslint --suppressions-location=custom/supp2.json ."
  }
}
`;

const OPTION_SCRIPTS = `{
  "name": "consumer",
  "scripts": {
    "lint": "eslint --rule 'hone/no-class-authoring: off' --ignore-pattern 'dormant/**' -c alt.config.mjs src",
    "lint:suppress": "eslint --suppress-all --suppress-rule hone/no-class-authoring src",
    "lint:extended": "eslint --rule 'hone/no-class-authoring-x: off' src",
    "lint:resolved": "eslint -c eslint.config.mjs --ignore-pattern 'gen/**' src",
    "lint:hidden": "eslint --ignore-pattern 'src/**' ."
  }
}
`;

const KEPT_IN_X = {
  clause: CLASS_SYNTAX,
  file: "x.ts",
  anchor: { line: 1, column: 7 },
  snippet: "export class Kept {}",
};

describe.each(LINES)("the development install's $line toolchain", (line) => {
  it("loads the ESLint major its line names", async () => {
    await expect(line.toolchain).resolves.toMatchObject({
      outcome: "ok",
      value: { eslintVersion: expect.stringMatching(line.eslintVersion) },
    });
  });
});

describe.each(LINES)(
  "real $line config resolution behind the ESLint runner's query instance, over a consumer repository",
  (line) => {
    it("reports an unrecorded override block placed after the projection as a config-override", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-override-after`);
      expect([
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: OVERRIDE_AFTER_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("x.ts")],
          trackedPaths: [repoPathOf("x.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [KEPT_IN_X],
          nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts" }],
          projection: "current",
        },
      });
    });

    it("reports an unrecorded global ignore over a file holding a class, and core still finds the class", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-global-ignore`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/gen`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: GLOBAL_IGNORE_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/gen/g.ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/src/clean.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("gen/g.ts"), repoPathOf("src/clean.ts")],
          trackedPaths: [repoPathOf("gen/g.ts"), repoPathOf("src/clean.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [
            {
              clause: CLASS_SYNTAX,
              file: "gen/g.ts",
              anchor: { line: 1, column: 7 },
              snippet: "export class Kept {}",
            },
          ],
          nativeExceptions: [{ kind: "ignore", clause: CLASS_SYNTAX, file: "gen/g.ts" }],
          projection: "current",
        },
      });
    });

    it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-severity-zero`);
      expect([
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: SEVERITY_ZERO_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("x.ts")],
          trackedPaths: [repoPathOf("x.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [KEPT_IN_X],
          nativeExceptions: [{ kind: "config-override", clause: CLASS_SYNTAX, file: "x.ts" }],
          projection: "current",
        },
      });
    });

    it("finds no projection in effect when a later team block sets a recorded file back to error", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-re-enabled-record`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: RE_ENABLED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: OWNED_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/src/owned.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("src/owned.ts")],
          trackedPaths: [repoPathOf("src/owned.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [OWNED_AUTHORISED_LOCATION],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          projection: "not-included",
          unprojectedFolders: [],
        },
      });
    });
  },
);

describe.each(LINES)(
  "eslint-suppressions.json files and package.json lint scripts read by the ESLint runner on $line, over a consumer repository",
  (line) => {
    it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-suppression-default`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/supp`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/eslint-suppressions.json`, text: DEFAULT_SUPPRESSIONS }),
        fileText.write({ path: `${repo}/supp/a.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("supp/a.ts")],
          trackedPaths: [repoPathOf("supp/a.ts"), repoPathOf("eslint-suppressions.json")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [
            {
              clause: CLASS_SYNTAX,
              file: "supp/a.ts",
              anchor: { line: 1, column: 7 },
              snippet: "export class Kept {}",
            },
          ],
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX,
              file: "supp/a.ts",
              location: "eslint-suppressions.json",
            },
          ],
        },
      });
    });

    it("reports entries in suppressions files a package.json script names in space and equals form, a dormant one included", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-suppression-scripted`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/supp`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/custom`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/package.json`, text: SUPPRESSION_SCRIPTS }),
        fileText.write({ path: `${repo}/custom/supp.json`, text: SCRIPTED_SUPPRESSIONS }),
        fileText.write({ path: `${repo}/custom/supp2.json`, text: DORMANT_SUPPRESSIONS }),
        fileText.write({ path: `${repo}/supp/b.ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/supp/clean.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("supp/b.ts"), repoPathOf("supp/clean.ts")],
          trackedPaths: [
            repoPathOf("supp/b.ts"),
            repoPathOf("supp/clean.ts"),
            repoPathOf("package.json"),
            repoPathOf("custom/supp.json"),
            repoPathOf("custom/supp2.json"),
          ],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [
            {
              clause: CLASS_SYNTAX,
              file: "supp/b.ts",
              anchor: { line: 1, column: 7 },
              snippet: "export class Kept {}",
            },
          ],
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX,
              file: "supp/b.ts",
              location: "custom/supp.json",
            },
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX,
              file: "supp/clean.ts",
              location: "custom/supp2.json",
            },
          ],
        },
      });
    });

    it("reports an entry in a nested tracked eslint-suppressions.json against its own directory", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-suppression-nested`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({
          path: `${repo}/packages/a/eslint-suppressions.json`,
          text: NESTED_SUPPRESSIONS,
        }),
        fileText.write({ path: `${repo}/packages/a/src/n.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("packages/a/src/n.ts")],
          trackedPaths: [
            repoPathOf("packages/a/src/n.ts"),
            repoPathOf("packages/a/eslint-suppressions.json"),
          ],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          nativeExceptions: [
            {
              kind: "suppression-entry",
              clause: CLASS_SYNTAX,
              file: "packages/a/src/n.ts",
              location: "packages/a/eslint-suppressions.json",
            },
          ],
        },
      });
    });

    it("reports each command-line option that weakens the run, and neither one that changes nothing ESLint already does nor a rule id that merely extends the selected one", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-command-line-options`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/package.json`, text: OPTION_SCRIPTS }),
        fileText.write({ path: `${repo}/src/plain.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("src/plain.ts")],
          trackedPaths: [repoPathOf("src/plain.ts"), repoPathOf("package.json")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX,
              location: "package.json",
              script: "lint",
              option: "--rule hone/no-class-authoring: off",
            },
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX,
              location: "package.json",
              script: "lint",
              option: "-c alt.config.mjs",
            },
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX,
              location: "package.json",
              script: "lint:suppress",
              option: "--suppress-all",
            },
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX,
              location: "package.json",
              script: "lint:suppress",
              option: "--suppress-rule hone/no-class-authoring",
            },
            {
              kind: "command-line-option",
              clause: CLASS_SYNTAX,
              location: "package.json",
              script: "lint:hidden",
              option: "--ignore-pattern src/**",
            },
          ],
        },
      });
    });
  },
);

const INLINE_FORM_FILES = [
  repoPathOf("i/disable-file.ts"),
  repoPathOf("i/disable-file-named.ts"),
  repoPathOf("i/disable-line.ts"),
  repoPathOf("i/disable-next-line.ts"),
  repoPathOf("i/rule-config.ts"),
  repoPathOf("i/other-rule.ts"),
  repoPathOf("i/enable.ts"),
  repoPathOf("i/global.ts"),
];

const DISABLE_FILE = "/* eslint-disable */\nexport class Kept {}\n";

const DISABLE_FILE_NAMED = "/* eslint-disable hone/no-class-authoring */\nexport class Kept {}\n";

const DISABLE_LINE =
  "export const plain = 1;\nexport class Kept {} // eslint-disable-line hone/no-class-authoring\n";

const DISABLE_NEXT_LINE =
  "// eslint-disable-next-line hone/no-class-authoring\nexport class Kept {}\n";

const RULE_CONFIG = '/* eslint hone/no-class-authoring: "off" */\nexport class Kept {}\n';

const OTHER_RULE = "/* eslint-disable no-console */\nexport class Kept {}\n";

const ENABLE = "/* eslint-enable hone/no-class-authoring */\nexport class Kept {}\n";

const GLOBAL = "/* global foo */\nexport class Kept {}\n";

const INLINE_FORM_EXCEPTIONS = [
  {
    kind: "inline-disable",
    clause: CLASS_SYNTAX,
    file: "i/disable-file.ts",
    line: 1,
    text: "/* eslint-disable */",
  },
  {
    kind: "inline-disable",
    clause: CLASS_SYNTAX,
    file: "i/disable-file-named.ts",
    line: 1,
    text: "/* eslint-disable hone/no-class-authoring */",
  },
  {
    kind: "inline-disable",
    clause: CLASS_SYNTAX,
    file: "i/disable-line.ts",
    line: 2,
    text: "// eslint-disable-line hone/no-class-authoring",
  },
  {
    kind: "inline-disable",
    clause: CLASS_SYNTAX,
    file: "i/disable-next-line.ts",
    line: 1,
    text: "// eslint-disable-next-line hone/no-class-authoring",
  },
  {
    kind: "inline-rule-config",
    clause: CLASS_SYNTAX,
    file: "i/rule-config.ts",
    line: 1,
    text: '/* eslint hone/no-class-authoring: "off" */',
  },
];

const INLINE_FORM_HITS = [
  {
    clause: CLASS_SYNTAX,
    file: "i/disable-file.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/disable-file-named.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/disable-line.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {} // eslint-disable-line hone/no-class-authoring",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/disable-next-line.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/rule-config.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/other-rule.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/enable.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "i/global.ts",
    anchor: { line: 2, column: 7 },
    snippet: "export class Kept {}",
  },
];

describe.each(LINES)(
  "inline configuration comments read by the ESLint runner's governance rule on real $line, over a consumer repository",
  (line) => {
    it("reports each disable and rule-config form naming the selected rule and none of the rest", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-inline-forms-reported`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/i`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/i/disable-file.ts`, text: DISABLE_FILE }),
        fileText.write({ path: `${repo}/i/disable-file-named.ts`, text: DISABLE_FILE_NAMED }),
        fileText.write({ path: `${repo}/i/disable-line.ts`, text: DISABLE_LINE }),
        fileText.write({ path: `${repo}/i/disable-next-line.ts`, text: DISABLE_NEXT_LINE }),
        fileText.write({ path: `${repo}/i/rule-config.ts`, text: RULE_CONFIG }),
        fileText.write({ path: `${repo}/i/other-rule.ts`, text: OTHER_RULE }),
        fileText.write({ path: `${repo}/i/enable.ts`, text: ENABLE }),
        fileText.write({ path: `${repo}/i/global.ts`, text: GLOBAL }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: INLINE_FORM_FILES,
          trackedPaths: INLINE_FORM_FILES,
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: { nativeExceptions: INLINE_FORM_EXCEPTIONS },
      });
    });

    it("still finds the class in every file whatever its inline comment says", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-inline-forms-found`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/i`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/i/disable-file.ts`, text: DISABLE_FILE }),
        fileText.write({ path: `${repo}/i/disable-file-named.ts`, text: DISABLE_FILE_NAMED }),
        fileText.write({ path: `${repo}/i/disable-line.ts`, text: DISABLE_LINE }),
        fileText.write({ path: `${repo}/i/disable-next-line.ts`, text: DISABLE_NEXT_LINE }),
        fileText.write({ path: `${repo}/i/rule-config.ts`, text: RULE_CONFIG }),
        fileText.write({ path: `${repo}/i/other-rule.ts`, text: OTHER_RULE }),
        fileText.write({ path: `${repo}/i/enable.ts`, text: ENABLE }),
        fileText.write({ path: `${repo}/i/global.ts`, text: GLOBAL }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: INLINE_FORM_FILES,
          trackedPaths: INLINE_FORM_FILES,
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({ outcome: "ok", value: { hits: INLINE_FORM_HITS } });
    });
  },
);

describe.each(LINES)(
  "real $line glob matching of the generated projection's record blocks, over a consumer repository",
  (line) => {
    it("matches route/[id].ts by its authorised location, leaving the projection current with no native exception", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-route-brackets`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/route`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: ROUTE_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/route/[id].ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/route/i.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("route/[id].ts"), repoPathOf("route/i.ts")],
          trackedPaths: [repoPathOf("route/[id].ts"), repoPathOf("route/i.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [ROUTE_AUTHORISED_LOCATION],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [
            {
              clause: CLASS_SYNTAX,
              file: "route/[id].ts",
              anchor: { line: 1, column: 7 },
              snippet: "export class Kept {}",
            },
            {
              clause: CLASS_SYNTAX,
              file: "route/i.ts",
              anchor: { line: 1, column: 7 },
              snippet: "export class Kept {}",
            },
          ],
          nativeExceptions: [],
          projection: "current",
        },
      });
    });
  },
);

describe.each(LINES)(
  "the ESLint runner's projection states under real $line, over a consumer repository",
  (line) => {
    it("reports the projection missing when it was never generated", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-projection-missing`);
      expect([
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: UNPROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("x.ts")],
          trackedPaths: [repoPathOf("x.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({ outcome: "ok", value: { hits: [], projection: "missing" } });
    });

    it("reports the projection out-of-date when it was hand-edited", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-projection-hand-edited`);
      expect([
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: HAND_EDITED_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("x.ts")],
          trackedPaths: [repoPathOf("x.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: { hits: [KEPT_IN_X], projection: "out-of-date" },
      });
    });

    it("reports no projection in effect when the team config does not import the projection", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-projection-not-imported`);
      expect([
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: UNPROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("x.ts")],
          trackedPaths: [repoPathOf("x.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          projection: "not-included",
          unprojectedFolders: [],
        },
      });
    });

    it("reports no projection in effect when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-fragment-not-projection`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: FRAGMENT_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: OWNED_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/src/owned.ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/src/clean.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: [repoPathOf("src/owned.ts"), repoPathOf("src/clean.ts")],
          trackedPaths: [repoPathOf("src/owned.ts"), repoPathOf("src/clean.ts")],
          clauses: [ESLINT_CLAUSE],
          records: [OWNED_AUTHORISED_LOCATION],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          hits: [],
          nativeExceptions: [],
          projection: "not-included",
          unprojectedFolders: [],
        },
      });
    });
  },
);

const SHARED_CASE_FILES = [
  repoPathOf("src/decl.ts"),
  repoPathOf("src/expr.ts"),
  repoPathOf("src/default.ts"),
  repoPathOf("src/abstract.ts"),
  repoPathOf("src/nested.ts"),
  repoPathOf("src/space.ts"),
  repoPathOf("src/anon.ts"),
];

const DECLARATION = "export class Alpha {}\n";

const EXPRESSION = "export const Beta = class {};\n";

const DEFAULT_EXPORT = "export default\nclass {}\n";

const ABSTRACT = "export abstract class Gamma {}\n";

const NESTED = "export function make() {\n  class Delta {}\n  return Delta;\n}\n";

const NAMESPACED = "export namespace Space {\n  export class Epsilon {}\n}\n";

const ANONYMOUS = "export const zeta = new (class {})();\n";

const EXPECTED_SHARED_ESLINT_HITS = [
  {
    clause: CLASS_SYNTAX,
    file: "src/decl.ts",
    anchor: { line: 1, column: 7 },
    snippet: "export class Alpha {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "src/expr.ts",
    anchor: { line: 1, column: 20 },
    snippet: "export const Beta = class {};",
  },
  {
    clause: CLASS_SYNTAX,
    file: "src/default.ts",
    anchor: { line: 2, column: 0 },
    snippet: "class {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "src/abstract.ts",
    anchor: { line: 1, column: 16 },
    snippet: "export abstract class Gamma {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "src/nested.ts",
    anchor: { line: 2, column: 2 },
    snippet: "class Delta {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "src/space.ts",
    anchor: { line: 2, column: 9 },
    snippet: "export class Epsilon {}",
  },
  {
    clause: CLASS_SYNTAX,
    file: "src/anon.ts",
    anchor: { line: 1, column: 25 },
    snippet: "export const zeta = new (class {})();",
  },
];

const EXPECTED_SHARED_AUDIT_HITS = [
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/decl.ts",
    anchor: { line: 1, column: 7 },
    snippet: "export class Alpha {}",
  },
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/expr.ts",
    anchor: { line: 1, column: 20 },
    snippet: "export const Beta = class {};",
  },
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/default.ts",
    anchor: { line: 2, column: 0 },
    snippet: "class {}",
  },
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/abstract.ts",
    anchor: { line: 1, column: 16 },
    snippet: "export abstract class Gamma {}",
  },
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/nested.ts",
    anchor: { line: 2, column: 2 },
    snippet: "class Delta {}",
  },
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/space.ts",
    anchor: { line: 2, column: 9 },
    snippet: "export class Epsilon {}",
  },
  {
    check: "authored-class-or-this#class-keyword",
    file: "src/anon.ts",
    anchor: { line: 1, column: 25 },
    snippet: "export const zeta = new (class {})();",
  },
];

const CLASS_SYNTAX_MEASURED_ON_SHARED_CASES = [
  { clause: CLASS_SYNTAX, file: "src/decl.ts" },
  { clause: CLASS_SYNTAX, file: "src/expr.ts" },
  { clause: CLASS_SYNTAX, file: "src/default.ts" },
  { clause: CLASS_SYNTAX, file: "src/abstract.ts" },
  { clause: CLASS_SYNTAX, file: "src/nested.ts" },
  { clause: CLASS_SYNTAX, file: "src/space.ts" },
  { clause: CLASS_SYNTAX, file: "src/anon.ts" },
];

const CLASS_KEYWORD_MEASURED_ON_SHARED_CASES = [
  { check: "authored-class-or-this#class-keyword", file: "src/decl.ts" },
  { check: "authored-class-or-this#class-keyword", file: "src/expr.ts" },
  { check: "authored-class-or-this#class-keyword", file: "src/default.ts" },
  { check: "authored-class-or-this#class-keyword", file: "src/abstract.ts" },
  { check: "authored-class-or-this#class-keyword", file: "src/nested.ts" },
  { check: "authored-class-or-this#class-keyword", file: "src/space.ts" },
  { check: "authored-class-or-this#class-keyword", file: "src/anon.ts" },
];

const SHARED_CASE_RUNS = {
  eslint: {
    outcome: "ok",
    value: {
      hits: EXPECTED_SHARED_ESLINT_HITS,
      nativeExceptions: [],
      projection: "current",
      slices: [],
      unprojectedFolders: [],
      measured: CLASS_SYNTAX_MEASURED_ON_SHARED_CASES,
    },
  },
  audit: {
    outcome: "ok",
    value: {
      hits: EXPECTED_SHARED_AUDIT_HITS,
      nativeExceptions: [],
      measured: CLASS_KEYWORD_MEASURED_ON_SHARED_CASES,
      projection: "none",
      slices: [],
      nestedConfigurations: [],
      unprojectedFolders: [],
      misnamedRuleIds: [],
    },
  },
};

describe.each(LINES)(
  "FR-3 over real files: the ESLint runner on real $line and the audit runner on real TypeScript",
  (line) => {
    it("give the same whole anchors for every flagged CD-14 shared case", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-fr3-anchors`);
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/src/decl.ts`, text: DECLARATION }),
        fileText.write({ path: `${repo}/src/expr.ts`, text: EXPRESSION }),
        fileText.write({ path: `${repo}/src/default.ts`, text: DEFAULT_EXPORT }),
        fileText.write({ path: `${repo}/src/abstract.ts`, text: ABSTRACT }),
        fileText.write({ path: `${repo}/src/nested.ts`, text: NESTED }),
        fileText.write({ path: `${repo}/src/space.ts`, text: NAMESPACED }),
        fileText.write({ path: `${repo}/src/anon.ts`, text: ANONYMOUS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      const eslintRun = await line.embeddedRunner.run({
        repoRoot: repo,
        installRoot: INSTALL_ROOT,
        declaredConfigRoots: [],
        files: SHARED_CASE_FILES,
        trackedPaths: SHARED_CASE_FILES,
        records: [],
        clauses: [ESLINT_CLAUSE],
      });
      const walkerRun = await walkerRunner.run({
        repoRoot: repo,
        installRoot: INSTALL_ROOT,
        declaredConfigRoots: [],
        files: SHARED_CASE_FILES,
        trackedPaths: SHARED_CASE_FILES,
        bindings: [WALKER_BINDING],
        answered: [],
        declaredConfigLookup: undefined,
        testFiles: { suffixes: ["test", "spec"], folders: [] },
      });
      expect({ eslint: eslintRun, audit: walkerRun }).toEqual(SHARED_CASE_RUNS);
    });
  },
);

const loadedNamedRunnerOf = loadedNamedRunnerOver({ runnerModuleOf: runnerModuleAt });

describe.each(LINES)(
  "named check conformance over the loaded ESLint runner, on real $line",
  (line) => {
    it("has no failures for CD-14#class-syntax over every CD-14 shared case", async () => {
      const load = vi
        .fn<ModuleLoaderPort["load"]>()
        .mockResolvedValue({ outcome: "ok", value: { namedChecksRunner: line.namedRunner } });
      const loaded = await loadedNamedRunnerOf({
        installRoot: INSTALL_ROOT,
        moduleExtension: ".ts",
        modules: { load },
        path,
        mechanism: "eslint",
      });
      const held = readHeldDiscipline({
        fileText,
        path,
        ruleSetRoot: INSTALL_ROOT,
        installRoot: INSTALL_ROOT,
        discipline: disciplineIdOf("CD-14"),
      });
      expect(load).toHaveBeenCalledWith({
        path: expect.stringMatching(
          /[\\/]src[\\/]infrastructure[\\/]engines[\\/]eslint[\\/]runner[\\/]runner\.ts$/,
        ),
      });
      expect(held).toMatchObject({
        outcome: "ok",
        value: {
          held: "present",
          file: {
            clauses: [
              { id: "class-syntax", kind: "mechanical" },
              { id: "static-only-class" },
              { id: "library-construction" },
            ],
          },
        },
      });
      assert(loaded.outcome === "ok", "core loads the ESLint runner module");
      assert(held.outcome === "ok", "CD-14 reads through the install's discipline reader");
      assert(held.value.held === "present", "CD-14 is held by the install");
      const [classSyntax] = held.value.file.clauses;
      assert.isDefined(classSyntax, "CD-14 declares a first clause");
      assert(
        classSyntax.kind === "mechanical",
        "CD-14 declares class-syntax as a mechanical clause",
      );
      await expect(
        namedCheckConformance({
          binding: ESLINT_CLASS_BINDING,
          cases: [...classSyntax.cases.flag, ...classSyntax.cases.allow],
          runner: loaded.value,
        }),
      ).resolves.toEqual({ outcome: "ok", value: [] });
    });
  },
);

const ESLINT_10_PACKAGE = '{"name":"eslint","version":"10.11.0"}';

const ESLINT_9_PACKAGE = '{"name":"eslint","version":"9.39.5"}';

const ROOT_LINT_SCRIPT = '{"scripts":{"lint":"eslint ."}}';

const NEAREST_LOOKUP_LINT_SCRIPT =
  '{"scripts":{"lint":"eslint --flag v10_config_lookup_from_file ."}}';

const NEAREST_LOOKUP_TEAMS = [
  {
    version: "10.11.0",
    lintCommand: "eslint .",
    eslintPackage: ESLINT_10_PACKAGE,
    lintScript: ROOT_LINT_SCRIPT,
  },
  {
    version: "9.39.5",
    lintCommand: "eslint --flag v10_config_lookup_from_file .",
    eslintPackage: ESLINT_9_PACKAGE,
    lintScript: NEAREST_LOOKUP_LINT_SCRIPT,
  },
];

const MONOREPO_FILES = [repoPathOf("packages/a/x.ts")];

const MONOREPO_TRACKED = [
  repoPathOf("packages/a/x.ts"),
  repoPathOf("package.json"),
  repoPathOf("packages/a/eslint.config.mjs"),
];

const PACKAGE_HIT = { file: "packages/a/x.ts" };

describe.each(LINES)(
  "the ESLint runner on $line follows the config lookup the team's own ESLint run uses, over a monorepo with a config per package",
  (line) => {
    it.each(NEAREST_LOOKUP_TEAMS)(
      "applies a package config's projection under ESLint $version running `$lintCommand`",
      async (team) => {
        const repo = `${SCRATCH}/${line.line}-package-config-applied-${team.version}`;
        expect([
          directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
          directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
          fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
          fileText.write({
            path: `${repo}/disciplines.eslint.mjs`,
            text: PACKAGE_LEGACY_ROOT_PROJECTION,
          }),
          fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
          fileText.write({
            path: `${repo}/packages/a/eslint.config.mjs`,
            text: SPREAD_SLICE_CONFIG,
          }),
          fileText.write({
            path: `${repo}/packages/a/disciplines.eslint.mjs`,
            text: PACKAGE_LEGACY_SLICE,
          }),
          fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
          fileText.write({
            path: `${repo}/node_modules/eslint/package.json`,
            text: team.eslintPackage,
          }),
          fileText.write({ path: `${repo}/package.json`, text: team.lintScript }),
        ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
        await expect(
          line.embeddedRunner.run({
            repoRoot: absolutePathSchema.parse(repo),
            installRoot: INSTALL_ROOT,
            declaredConfigRoots: [],
            files: MONOREPO_FILES,
            trackedPaths: MONOREPO_TRACKED,
            clauses: [ESLINT_CLAUSE],
            records: [PACKAGE_LEGACY_CARVE_OUT],
          }),
        ).resolves.toMatchObject({
          outcome: "ok",
          value: { hits: [PACKAGE_HIT], projection: "current" },
        });
      },
    );

    it("finds no projection in effect under ESLint 9 run from the root, which loads only the root config", async () => {
      const repo = `${SCRATCH}/${line.line}-package-config-from-the-root`;
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
        fileText.write({
          path: `${repo}/disciplines.eslint.mjs`,
          text: PACKAGE_LEGACY_ROOT_PROJECTION,
        }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
        fileText.write({
          path: `${repo}/packages/a/disciplines.eslint.mjs`,
          text: PACKAGE_LEGACY_SLICE,
        }),
        fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
        fileText.write({
          path: `${repo}/node_modules/eslint/package.json`,
          text: ESLINT_9_PACKAGE,
        }),
        fileText.write({ path: `${repo}/package.json`, text: ROOT_LINT_SCRIPT }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: absolutePathSchema.parse(repo),
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [PACKAGE_LEGACY_CARVE_OUT],
        }),
      ).resolves.toMatchObject({ outcome: "ok", value: { hits: [], projection: "not-included" } });
    });

    it.each(NEAREST_LOOKUP_TEAMS)(
      "finds no projection in effect where a package config drops it under ESLint $version running `$lintCommand`",
      async (team) => {
        const repo = `${SCRATCH}/${line.line}-root-config-dropped-${team.version}`;
        expect([
          directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
          directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
          fileText.write({ path: `${repo}/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
          fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
          fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
          fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: BARE_CONFIG }),
          fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
          fileText.write({
            path: `${repo}/node_modules/eslint/package.json`,
            text: team.eslintPackage,
          }),
          fileText.write({ path: `${repo}/package.json`, text: team.lintScript }),
        ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
        await expect(
          line.embeddedRunner.run({
            repoRoot: absolutePathSchema.parse(repo),
            installRoot: INSTALL_ROOT,
            declaredConfigRoots: [],
            files: MONOREPO_FILES,
            trackedPaths: MONOREPO_TRACKED,
            clauses: [ESLINT_CLAUSE],
            records: [],
          }),
        ).resolves.toMatchObject({
          outcome: "ok",
          value: { hits: [], projection: "not-included" },
        });
      },
    );

    it("applies the root config's projection to every package under ESLint 9 run from the root", async () => {
      const repo = `${SCRATCH}/${line.line}-root-config-from-the-root`;
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: BARE_CONFIG }),
        fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
        fileText.write({
          path: `${repo}/node_modules/eslint/package.json`,
          text: ESLINT_9_PACKAGE,
        }),
        fileText.write({ path: `${repo}/package.json`, text: ROOT_LINT_SCRIPT }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: absolutePathSchema.parse(repo),
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: { hits: [PACKAGE_HIT], projection: "current" },
      });
    });
  },
);

describe.each(LINES)("a package that spreads its own projection slice, on real $line", (line) => {
  it("lints from its own folder against its own config, honouring its carve-out", async () => {
    const repo = `${SCRATCH}/${line.line}-slice-honoured`;
    expect([
      directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
      fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
      fileText.write({
        path: `${repo}/packages/a/disciplines.eslint.mjs`,
        text: PACKAGE_LEGACY_SLICE,
      }),
    ]).toEqual([DONE, DONE, DONE, DONE]);
    const { ESLint } = await line.eslintModule();
    await expect(
      new ESLint({ cwd: `${repo}/packages/a` }).lintText("export class Inherited {}\n", {
        filePath: `${repo}/packages/a/legacy.ts`,
      }),
    ).resolves.toMatchObject([{ messages: [] }]);
  });

  it("lints from its own folder against its own config, still flagging a file its carve-outs do not name", async () => {
    const repo = `${SCRATCH}/${line.line}-slice-flagging`;
    expect([
      directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
      fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
      fileText.write({
        path: `${repo}/packages/a/disciplines.eslint.mjs`,
        text: PACKAGE_LEGACY_SLICE,
      }),
    ]).toEqual([DONE, DONE, DONE, DONE]);
    const { ESLint } = await line.eslintModule();
    await expect(
      new ESLint({ cwd: `${repo}/packages/a` }).lintText("export class Inherited {}\n", {
        filePath: `${repo}/packages/a/fresh.ts`,
      }),
    ).resolves.toMatchObject([{ messages: [{ ruleId: "hone/no-class-authoring" }] }]);
  });

  it.each(NEAREST_LOOKUP_TEAMS)(
    "is judged the same by the check from the root under ESLint $version running `$lintCommand`: slice current and applied, the uncarved file flagged",
    async (team) => {
      const repo = `${SCRATCH}/${line.line}-slice-judged-${team.version}`;
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
        fileText.write({
          path: `${repo}/disciplines.eslint.mjs`,
          text: PACKAGE_LEGACY_ROOT_PROJECTION,
        }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
        fileText.write({
          path: `${repo}/packages/a/disciplines.eslint.mjs`,
          text: PACKAGE_LEGACY_SLICE,
        }),
        fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
        fileText.write({
          path: `${repo}/node_modules/eslint/package.json`,
          text: team.eslintPackage,
        }),
        fileText.write({ path: `${repo}/package.json`, text: team.lintScript }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: absolutePathSchema.parse(repo),
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [PACKAGE_LEGACY_CARVE_OUT],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: { hits: [PACKAGE_HIT], projection: "current", slices: [], unprojectedFolders: [] },
      });
    },
  );

  it.each(NEAREST_LOOKUP_TEAMS)(
    "names the slice of a package whose config spreads no slice as missing and not applied under ESLint $version running `$lintCommand`",
    async (team) => {
      const repo = `${SCRATCH}/${line.line}-slice-missing-${team.version}`;
      expect([
        directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: BARE_CONFIG }),
        fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
        fileText.write({
          path: `${repo}/node_modules/eslint/package.json`,
          text: team.eslintPackage,
        }),
        fileText.write({ path: `${repo}/package.json`, text: team.lintScript }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: absolutePathSchema.parse(repo),
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toMatchObject({
        outcome: "ok",
        value: {
          projection: "not-included",
          slices: [
            { slice: "packages/a/disciplines.eslint.mjs", state: "missing" },
            { slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" },
          ],
        },
      });
    },
  );

  it("requires no slice for a package config ESLint 9 never loads, resolving every file from the root config", async () => {
    const repo = `${SCRATCH}/${line.line}-slice-never-loaded`;
    expect([
      directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
      directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
      fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
      fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: BARE_CONFIG }),
      fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
      fileText.write({ path: `${repo}/node_modules/eslint/package.json`, text: ESLINT_9_PACKAGE }),
      fileText.write({ path: `${repo}/package.json`, text: ROOT_LINT_SCRIPT }),
    ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
    await expect(
      line.embeddedRunner.run({
        repoRoot: absolutePathSchema.parse(repo),
        installRoot: INSTALL_ROOT,
        declaredConfigRoots: [],
        files: MONOREPO_FILES,
        trackedPaths: MONOREPO_TRACKED,
        clauses: [ESLINT_CLAUSE],
        records: [],
      }),
    ).resolves.toMatchObject({
      outcome: "ok",
      value: { projection: "current", slices: [], unprojectedFolders: [] },
    });
  });
});
