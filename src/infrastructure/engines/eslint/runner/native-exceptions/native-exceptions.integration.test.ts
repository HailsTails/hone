import { afterAll, assert, describe, expect, it } from "vitest";

import type { ExceptionRecord } from "../../../../../domain/records/discipline-exceptions/exception-record.ts";
import type { VersionOneWhyChain } from "../../../../../domain/records/discipline-exceptions/version-one-why-chain.ts";
import { repoPathOf } from "../../../../../domain/repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../../../../domain/rule-set/clause-address.ts";
import { clauseIdOf } from "../../../../../domain/rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../../../../domain/rule-set/discipline-id-of.ts";
import type { RunnerClause } from "../../../../../domain/runner/runner-module-types.ts";
import { absolutePathSchema } from "../../../../content-files/absolute-path.ts";
import { FIRST_EDITION } from "../../../../content-files/edition.ts";
import { createDefaultDirectoryTreePort } from "../../../../node/file-system/directory-tree-port.ts";
import { createDefaultFileRemovalPort } from "../../../../node/file-system/file-removal-port.ts";
import { createDefaultDirectoryPort } from "../../../../node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../../../node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../../../node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../../../node/path-port.ts";
import { toolchainBoundEmbeddedRunner } from "../../../protocol/toolchain/toolchain-bound-runner.ts";
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
    eslintVersion: "10.15.0",
    classMessageNodeType: undefined,
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
  },
  {
    line: "eslint-9",
    eslintVersion: "9.39.5",
    classMessageNodeType: null,
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

describe.each(LINES)("the development install's $line toolchain", (line) => {
  it("loads the ESLint major its line names", async () => {
    const loaded = await line.toolchain;
    assert(
      loaded.outcome === "ok",
      `the ${line.line} toolchain loads from the development install`,
    );
    expect(loaded.value.eslintVersion).toBe(line.eslintVersion);
  });
});

const OVERRIDE_AFTER_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "x.ts" }],
    nativeExceptions: [{ clause: CLASS_SYNTAX, file: "x.ts", kind: "config-override" }],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const GLOBAL_IGNORE_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "gen/g.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [
      { clause: CLASS_SYNTAX, file: "gen/g.ts" },
      { clause: CLASS_SYNTAX, file: "src/clean.ts" },
    ],
    nativeExceptions: [{ clause: CLASS_SYNTAX, file: "gen/g.ts", kind: "ignore" }],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const SEVERITY_ZERO_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "x.ts" }],
    nativeExceptions: [{ clause: CLASS_SYNTAX, file: "x.ts", kind: "config-override" }],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const RE_ENABLED_RECORD_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)(
  "real $line config resolution behind the ESLint runner's query instance, over a consumer repository",
  (line) => {
    it("reports an unrecorded override block placed after the projection as a config-override", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-override-after`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: OVERRIDE_AFTER_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(OVERRIDE_AFTER_RUN);
    });

    it("reports an unrecorded global ignore over a file holding a class, and core still finds the class", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-global-ignore`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/gen`) }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: GLOBAL_IGNORE_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/gen/g.ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/src/clean.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(GLOBAL_IGNORE_RUN);
    });

    it("reports a rule the team sets to severity 0 everywhere with no records as config-overrides, the projection still in effect", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-severity-zero`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: SEVERITY_ZERO_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(SEVERITY_ZERO_RUN);
    });

    it("finds no projection in effect when a later team block sets a recorded file back to error", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-re-enabled-record`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: RE_ENABLED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: OWNED_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/src/owned.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(RE_ENABLED_RECORD_RUN);
    });
  },
);

const SUPPRESSION_DEFAULT_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "supp/a.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "supp/a.ts" }],
    nativeExceptions: [
      {
        clause: CLASS_SYNTAX,
        file: "supp/a.ts",
        kind: "suppression-entry",
        location: "eslint-suppressions.json",
      },
    ],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const SUPPRESSION_SCRIPTED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "supp/b.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [
      { clause: CLASS_SYNTAX, file: "supp/b.ts" },
      { clause: CLASS_SYNTAX, file: "supp/clean.ts" },
    ],
    nativeExceptions: [
      {
        clause: CLASS_SYNTAX,
        file: "supp/b.ts",
        kind: "suppression-entry",
        location: "custom/supp.json",
      },
      {
        clause: CLASS_SYNTAX,
        file: "supp/clean.ts",
        kind: "suppression-entry",
        location: "custom/supp2.json",
      },
    ],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const SUPPRESSION_NESTED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "packages/a/src/n.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "packages/a/src/n.ts" }],
    nativeExceptions: [
      {
        clause: CLASS_SYNTAX,
        file: "packages/a/src/n.ts",
        kind: "suppression-entry",
        location: "packages/a/eslint-suppressions.json",
      },
    ],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const COMMAND_LINE_OPTIONS_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [{ clause: CLASS_SYNTAX, file: "src/plain.ts" }],
    nativeExceptions: [
      {
        cause: { kind: "weakens-run" },
        clause: CLASS_SYNTAX,
        kind: "command-line-option",
        location: "package.json",
        option: "--rule hone/no-class-authoring: off",
        script: "lint",
      },
      {
        cause: { kind: "weakens-run" },
        clause: CLASS_SYNTAX,
        kind: "command-line-option",
        location: "package.json",
        option: "-c alt.config.mjs",
        script: "lint",
      },
      {
        cause: { kind: "weakens-run" },
        clause: CLASS_SYNTAX,
        kind: "command-line-option",
        location: "package.json",
        option: "--suppress-all",
        script: "lint:suppress",
      },
      {
        cause: { kind: "weakens-run" },
        clause: CLASS_SYNTAX,
        kind: "command-line-option",
        location: "package.json",
        option: "--suppress-rule hone/no-class-authoring",
        script: "lint:suppress",
      },
      {
        cause: { kind: "weakens-run" },
        clause: CLASS_SYNTAX,
        kind: "command-line-option",
        location: "package.json",
        option: "--ignore-pattern src/**",
        script: "lint:hidden",
      },
    ],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)(
  "eslint-suppressions.json files and package.json lint scripts read by the ESLint runner on $line, over a consumer repository",
  (line) => {
    it("reports an entry in the default eslint-suppressions.json as a suppression-entry", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-suppression-default`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/supp`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/eslint-suppressions.json`, text: DEFAULT_SUPPRESSIONS }),
        fileText.write({ path: `${repo}/supp/a.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(SUPPRESSION_DEFAULT_RUN);
    });

    it("reports entries in suppressions files a package.json script names in space and equals form, a dormant one included", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-suppression-scripted`);
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(SUPPRESSION_SCRIPTED_RUN);
    });

    it("reports an entry in a nested tracked eslint-suppressions.json against its own directory", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-suppression-nested`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({
          path: `${repo}/packages/a/eslint-suppressions.json`,
          text: NESTED_SUPPRESSIONS,
        }),
        fileText.write({ path: `${repo}/packages/a/src/n.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(SUPPRESSION_NESTED_RUN);
    });

    it("reports each command-line option that weakens the run, and neither one that changes nothing ESLint already does nor a rule id that merely extends the selected one", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-command-line-options`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/package.json`, text: OPTION_SCRIPTS }),
        fileText.write({ path: `${repo}/src/plain.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(COMMAND_LINE_OPTIONS_RUN);
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

const INLINE_FORMS_REPORTED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-file.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-file-named.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-line.ts",
        snippet: "export class Kept {} // eslint-disable-line hone/no-class-authoring",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-next-line.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/rule-config.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/other-rule.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/enable.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/global.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [
      { clause: CLASS_SYNTAX, file: "i/disable-file.ts" },
      { clause: CLASS_SYNTAX, file: "i/disable-file-named.ts" },
      { clause: CLASS_SYNTAX, file: "i/disable-line.ts" },
      { clause: CLASS_SYNTAX, file: "i/disable-next-line.ts" },
      { clause: CLASS_SYNTAX, file: "i/rule-config.ts" },
      { clause: CLASS_SYNTAX, file: "i/other-rule.ts" },
      { clause: CLASS_SYNTAX, file: "i/enable.ts" },
      { clause: CLASS_SYNTAX, file: "i/global.ts" },
    ],
    nativeExceptions: [
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-file.ts",
        kind: "inline-disable",
        line: 1,
        reach: "every-selected-clause",
        text: "/* eslint-disable */",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-file-named.ts",
        kind: "inline-disable",
        line: 1,
        reach: "one-clause",
        text: "/* eslint-disable hone/no-class-authoring */",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-line.ts",
        kind: "inline-disable",
        line: 2,
        reach: "one-clause",
        text: "// eslint-disable-line hone/no-class-authoring",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-next-line.ts",
        kind: "inline-disable",
        line: 1,
        reach: "one-clause",
        text: "// eslint-disable-next-line hone/no-class-authoring",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/rule-config.ts",
        kind: "inline-rule-config",
        line: 1,
        text: '/* eslint hone/no-class-authoring: "off" */',
      },
    ],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const INLINE_FORMS_FOUND_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-file.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-file-named.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-line.ts",
        snippet: "export class Kept {} // eslint-disable-line hone/no-class-authoring",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/disable-next-line.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/rule-config.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/other-rule.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/enable.ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 2 },
        clause: CLASS_SYNTAX,
        file: "i/global.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [
      { clause: CLASS_SYNTAX, file: "i/disable-file.ts" },
      { clause: CLASS_SYNTAX, file: "i/disable-file-named.ts" },
      { clause: CLASS_SYNTAX, file: "i/disable-line.ts" },
      { clause: CLASS_SYNTAX, file: "i/disable-next-line.ts" },
      { clause: CLASS_SYNTAX, file: "i/rule-config.ts" },
      { clause: CLASS_SYNTAX, file: "i/other-rule.ts" },
      { clause: CLASS_SYNTAX, file: "i/enable.ts" },
      { clause: CLASS_SYNTAX, file: "i/global.ts" },
    ],
    nativeExceptions: [
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-file.ts",
        kind: "inline-disable",
        line: 1,
        reach: "every-selected-clause",
        text: "/* eslint-disable */",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-file-named.ts",
        kind: "inline-disable",
        line: 1,
        reach: "one-clause",
        text: "/* eslint-disable hone/no-class-authoring */",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-line.ts",
        kind: "inline-disable",
        line: 2,
        reach: "one-clause",
        text: "// eslint-disable-line hone/no-class-authoring",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/disable-next-line.ts",
        kind: "inline-disable",
        line: 1,
        reach: "one-clause",
        text: "// eslint-disable-next-line hone/no-class-authoring",
      },
      {
        clause: CLASS_SYNTAX,
        file: "i/rule-config.ts",
        kind: "inline-rule-config",
        line: 1,
        text: '/* eslint hone/no-class-authoring: "off" */',
      },
    ],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)(
  "inline configuration comments read by the ESLint runner's governance rule on real $line, over a consumer repository",
  (line) => {
    it("reports each disable and rule-config form naming the selected rule and none of the rest", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-inline-forms-reported`);
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(INLINE_FORMS_REPORTED_RUN);
    });

    it("still finds the class in every file whatever its inline comment says", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-inline-forms-found`);
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(INLINE_FORMS_FOUND_RUN);
    });
  },
);

const ROUTE_BRACKETS_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "route/[id].ts",
        snippet: "export class Kept {}",
      },
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "route/i.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [
      { clause: CLASS_SYNTAX, file: "route/[id].ts" },
      { clause: CLASS_SYNTAX, file: "route/i.ts" },
    ],
    nativeExceptions: [],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)(
  "real $line glob matching of the generated projection's record blocks, over a consumer repository",
  (line) => {
    it("matches route/[id].ts by its authorised location, leaving the projection current with no native exception", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-route-brackets`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/route`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: ROUTE_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/route/[id].ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/route/i.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(ROUTE_BRACKETS_RUN);
    });
  },
);

const PROJECTION_MISSING_RUN = {
  outcome: "ok",
  value: { hits: [], measured: [], nativeExceptions: [], projection: "missing", slices: [] },
};

const PROJECTION_HAND_EDITED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "x.ts" }],
    nativeExceptions: [],
    projection: "out-of-date",
    slices: [],
    unprojectedFolders: [],
  },
};

const PROJECTION_NOT_IMPORTED_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [],
    unprojectedFolders: [],
  },
};

const FRAGMENT_NOT_PROJECTION_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)(
  "the ESLint runner's projection states under real $line, over a consumer repository",
  (line) => {
    it("reports the projection missing when it was never generated", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-projection-missing`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: UNPROJECTED_CONFIG }),
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
      ).resolves.toEqual(PROJECTION_MISSING_RUN);
    });

    it("reports the projection out-of-date when it was hand-edited", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-projection-hand-edited`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: PROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: HAND_EDITED_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(PROJECTION_HAND_EDITED_RUN);
    });

    it("reports no projection in effect when the team config does not import the projection", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-projection-not-imported`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: repo }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: UNPROJECTED_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/x.ts`, text: KEPT_CLASS }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(PROJECTION_NOT_IMPORTED_RUN);
    });

    it("reports no projection in effect when the piece's fragment is imported instead of the projection beside an authorised location", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-fragment-not-projection`);
      expect([
        directoryTree.remove({ path: repo }),
        directory.create({ path: absolutePathSchema.parse(`${repo}/src`) }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: FRAGMENT_CONFIG }),
        fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: OWNED_PROJECTION }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
        fileText.write({ path: `${repo}/src/owned.ts`, text: KEPT_CLASS }),
        fileText.write({ path: `${repo}/src/clean.ts`, text: PLAIN }),
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
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
      ).resolves.toEqual(FRAGMENT_NOT_PROJECTION_RUN);
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

const PACKAGE_CONFIG_APPLIED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "packages/a/x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "packages/a/x.ts" }],
    nativeExceptions: [],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const PACKAGE_CONFIG_FROM_THE_ROOT_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [],
    unprojectedFolders: [],
  },
};

const ROOT_CONFIG_DROPPED_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [
      { slice: "packages/a/disciplines.eslint.mjs", state: "missing" },
      { slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" },
    ],
    unprojectedFolders: [],
  },
};

const ROOT_CONFIG_FROM_THE_ROOT_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "packages/a/x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "packages/a/x.ts" }],
    nativeExceptions: [],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)(
  "the ESLint runner on $line follows the config lookup the team's own ESLint run uses, over a monorepo with a config per package",
  (line) => {
    it.each(NEAREST_LOOKUP_TEAMS)(
      "applies a package config's projection under ESLint $version running `$lintCommand`",
      async (team) => {
        const repo = absolutePathSchema.parse(
          `${SCRATCH}/${line.line}-package-config-applied-${team.version}`,
        );
        expect([
          directoryTree.remove({ path: repo }),
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
        ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
        await expect(
          line.embeddedRunner.run({
            repoRoot: repo,
            installRoot: INSTALL_ROOT,
            declaredConfigRoots: [],
            files: MONOREPO_FILES,
            trackedPaths: MONOREPO_TRACKED,
            clauses: [ESLINT_CLAUSE],
            records: [PACKAGE_LEGACY_CARVE_OUT],
          }),
        ).resolves.toEqual(PACKAGE_CONFIG_APPLIED_RUN);
      },
    );

    it("finds no projection in effect under ESLint 9 run from the root, which loads only the root config", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-package-config-from-the-root`);
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [PACKAGE_LEGACY_CARVE_OUT],
        }),
      ).resolves.toEqual(PACKAGE_CONFIG_FROM_THE_ROOT_RUN);
    });

    it.each(NEAREST_LOOKUP_TEAMS)(
      "finds no projection in effect where a package config drops it under ESLint $version running `$lintCommand`",
      async (team) => {
        const repo = absolutePathSchema.parse(
          `${SCRATCH}/${line.line}-root-config-dropped-${team.version}`,
        );
        expect([
          directoryTree.remove({ path: repo }),
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
        ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
        await expect(
          line.embeddedRunner.run({
            repoRoot: repo,
            installRoot: INSTALL_ROOT,
            declaredConfigRoots: [],
            files: MONOREPO_FILES,
            trackedPaths: MONOREPO_TRACKED,
            clauses: [ESLINT_CLAUSE],
            records: [],
          }),
        ).resolves.toEqual(ROOT_CONFIG_DROPPED_RUN);
      },
    );

    it("applies the root config's projection to every package under ESLint 9 run from the root", async () => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-root-config-from-the-root`);
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toEqual(ROOT_CONFIG_FROM_THE_ROOT_RUN);
    });
  },
);

const SLICE_JUDGED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "packages/a/x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "packages/a/x.ts" }],
    nativeExceptions: [],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

const SLICE_MISSING_RUN = {
  outcome: "ok",
  value: {
    hits: [],
    measured: [],
    nativeExceptions: [],
    projection: "not-included",
    slices: [
      { slice: "packages/a/disciplines.eslint.mjs", state: "missing" },
      { slice: "packages/a/disciplines.eslint.mjs", state: "not-applied" },
    ],
    unprojectedFolders: [],
  },
};

const SLICE_NEVER_LOADED_RUN = {
  outcome: "ok",
  value: {
    hits: [
      {
        anchor: { column: 7, line: 1 },
        clause: CLASS_SYNTAX,
        file: "packages/a/x.ts",
        snippet: "export class Kept {}",
      },
    ],
    measured: [{ clause: CLASS_SYNTAX, file: "packages/a/x.ts" }],
    nativeExceptions: [],
    projection: "current",
    slices: [],
    unprojectedFolders: [],
  },
};

describe.each(LINES)("a package that spreads its own projection slice, on real $line", (line) => {
  it("lints from its own folder against its own config, honouring its carve-out", async () => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-slice-honoured`);
    expect([
      directoryTree.remove({ path: repo }),
      directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
      fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
      fileText.write({
        path: `${repo}/packages/a/disciplines.eslint.mjs`,
        text: PACKAGE_LEGACY_SLICE,
      }),
    ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
    const linted = path.join({ segments: [repo, "packages", "a", "legacy.ts"] });
    const { ESLint } = await line.eslintModule();
    await expect(
      new ESLint({ cwd: `${repo}/packages/a` }).lintText("export class Inherited {}\n", {
        filePath: linted,
      }),
    ).resolves.toEqual([
      {
        filePath: linted,
        messages: [],
        errorCount: 0,
        fatalErrorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        suppressedMessages: [],
        usedDeprecatedRules: [],
      },
    ]);
  });

  it("lints from its own folder against its own config, still flagging a file its carve-outs do not name", async () => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-slice-flagging`);
    expect([
      directoryTree.remove({ path: repo }),
      directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: BARE_CONFIG }),
      fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
      fileText.write({
        path: `${repo}/packages/a/disciplines.eslint.mjs`,
        text: PACKAGE_LEGACY_SLICE,
      }),
    ]).toEqual([DONE, DONE, DONE, DONE, DONE]);
    const linted = path.join({ segments: [repo, "packages", "a", "fresh.ts"] });
    const { ESLint } = await line.eslintModule();
    await expect(
      new ESLint({ cwd: `${repo}/packages/a` }).lintText("export class Inherited {}\n", {
        filePath: linted,
      }),
    ).resolves.toEqual([
      {
        filePath: linted,
        messages: [
          {
            ruleId: "hone/no-class-authoring",
            severity: 2,
            message: expect.any(String),
            messageId: "noClass",
            nodeType: line.classMessageNodeType,
            line: 1,
            column: 8,
            endLine: 1,
            endColumn: 13,
          },
        ],
        errorCount: 1,
        fatalErrorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        source: "export class Inherited {}\n",
        suppressedMessages: [],
        usedDeprecatedRules: [],
      },
    ]);
  });

  it.each(NEAREST_LOOKUP_TEAMS)(
    "is judged the same by the check from the root under ESLint $version running `$lintCommand`: slice current and applied, the uncarved file flagged",
    async (team) => {
      const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-slice-judged-${team.version}`);
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [PACKAGE_LEGACY_CARVE_OUT],
        }),
      ).resolves.toEqual(SLICE_JUDGED_RUN);
    },
  );

  it.each(NEAREST_LOOKUP_TEAMS)(
    "names the slice of a package whose config spreads no slice as missing and not applied under ESLint $version running `$lintCommand`",
    async (team) => {
      const repo = absolutePathSchema.parse(
        `${SCRATCH}/${line.line}-slice-missing-${team.version}`,
      );
      expect([
        directoryTree.remove({ path: repo }),
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
      ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
      await expect(
        line.embeddedRunner.run({
          repoRoot: repo,
          installRoot: INSTALL_ROOT,
          declaredConfigRoots: [],
          files: MONOREPO_FILES,
          trackedPaths: MONOREPO_TRACKED,
          clauses: [ESLINT_CLAUSE],
          records: [],
        }),
      ).resolves.toEqual(SLICE_MISSING_RUN);
    },
  );

  it("requires no slice for a package config ESLint 9 never loads, resolving every file from the root config", async () => {
    const repo = absolutePathSchema.parse(`${SCRATCH}/${line.line}-slice-never-loaded`);
    expect([
      directoryTree.remove({ path: repo }),
      directory.create({ path: absolutePathSchema.parse(`${repo}/packages/a`) }),
      directory.create({ path: absolutePathSchema.parse(`${repo}/node_modules/eslint`) }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: SPREAD_SLICE_CONFIG }),
      fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: PROJECTION }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SETTINGS }),
      fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: BARE_CONFIG }),
      fileText.write({ path: `${repo}/packages/a/x.ts`, text: KEPT_CLASS }),
      fileText.write({ path: `${repo}/node_modules/eslint/package.json`, text: ESLINT_9_PACKAGE }),
      fileText.write({ path: `${repo}/package.json`, text: ROOT_LINT_SCRIPT }),
    ]).toEqual([DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE, DONE]);
    await expect(
      line.embeddedRunner.run({
        repoRoot: repo,
        installRoot: INSTALL_ROOT,
        declaredConfigRoots: [],
        files: MONOREPO_FILES,
        trackedPaths: MONOREPO_TRACKED,
        clauses: [ESLINT_CLAUSE],
        records: [],
      }),
    ).resolves.toEqual(SLICE_NEVER_LOADED_RUN);
  });
});
