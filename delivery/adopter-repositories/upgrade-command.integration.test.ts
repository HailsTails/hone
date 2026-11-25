import { afterAll, describe, expect, it, onTestFinished, vi } from "vitest";

import type { RunnerModuleOf } from "../../src/application/ports/engine/runner-location.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import type { VersionOneCommandRequest } from "../../src/application/ports/version-one-command-request.ts";
import {
  INSTALLED_PORTS,
  runToolCommand,
  toolSubcommandsOf,
} from "../../src/composition/run-tool-command.ts";
import { type RunnerEngines, runnerEnginesOver } from "../../src/composition/runner-engines.ts";
import type { Subcommand } from "../../src/infrastructure/command-line/arguments/command-line.ts";
import { shownPathOfRepository } from "../../src/infrastructure/command-line/installation/shown-path.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultExceptionRepositoryOf } from "../../src/infrastructure/discipline-exceptions-folder/exception-layout.ts";
import { exceptionEntryParser } from "../../src/infrastructure/discipline-exceptions-folder/exception-records.ts";
import { createSelectionRepository } from "../../src/infrastructure/disciplines-file/consumer-selection.ts";
import { eslintRunnerModuleOver } from "../../src/infrastructure/engines/eslint/runner/eslint-runner-module.ts";
import {
  eslint9PieceModules,
  eslint9ToolchainModules,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-9/eslint-9-engine.ts";
import {
  defaultEslintToolchainPeers,
  loadEslintToolchain,
} from "../../src/infrastructure/engines/eslint/runner/toolchain/eslint-toolchain.ts";
import { createDefaultGitPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultFileRemovalPort } from "../../src/infrastructure/node/file-system/file-removal-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultModuleLoaderPort } from "../../src/infrastructure/node/modules/module-loader-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import {
  createDefaultCommandRunPort,
  createDefaultScratchFilesPort,
} from "../install-proof/install-proof-ports.ts";

const INSTALL_ROOT = absolutePathSchema.parse(`${import.meta.dirname}/../..`);

const ENTRY_URL = new URL("../../src/hone.ts", import.meta.url).href;

const fileText = createDefaultFileTextPort({});

const path = createDefaultPathPort({});

const scratch = createDefaultScratchFilesPort({});

const commands = createDefaultCommandRunPort({});

const DEVELOPMENT_PEERS = defaultEslintToolchainPeers({
  installRoot: INSTALL_ROOT,
  installForm: "source",
});

const GIT_INIT = ["init", "-q"];

const GIT_ADD = ["add", "."];

const GIT_COMMIT = [
  "-c",
  "user.name=proof",
  "-c",
  "user.email=proof@example.test",
  "commit",
  "-q",
  "-m",
  "base",
];

const GIT_STATUS = ["status", "--porcelain"];

const GIT_LIST = ["ls-files"];

const DONE = { outcome: "ok", value: null };

const WRITTEN = { outcome: "ok", value: undefined };

const SUCCEEDED = expect.objectContaining({ outcome: "exited", exitCode: 0 });

const UNCHANGED = { outcome: "exited", exitCode: 0, output: "" };

const SELECTION =
  '{ "version": 1, "ruleSets": {}, "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const DECLARED_SELECTION =
  '{ "version": 1, "ruleSets": {}, "eslintConfigLookup": "repository-root", "eslintConfigRoots": ["packages/a"], "clauses": { "CD-14#class-syntax": "eslint", "CD-14#static-only-class": "eslint" } }\n';

const NO_RECORDS = '{ "version": 1, "exceptions": [] }\n';

const SRC_CARVE_OUT =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "src/kept.ts", "reason": "legacy class" }] }\n';

const PACKAGE_CARVE_OUT =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "packages/a/kept.ts", "reason": "legacy class" }] }\n';

const ROOT_CARVE_OUT =
  '{ "version": 1, "exceptions": [{ "kind": "file-carve-out", "clause": "CD-14#class-syntax", "file": "kept.ts", "reason": "legacy class" }] }\n';

const TEAM_CONFIG =
  'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...projection];\n';

const TEAM_CONFIG_IGNORING_DECLARATIONS =
  'import projection from "./disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, { ignores: ["*.d.mts"] }, ...projection];\n';

const ROOT_CONFIG_IMPORTING_PACKAGE_SLICE =
  'import projection from "./disciplines.eslint.mjs";\nimport packageProjection from "./packages/a/disciplines.eslint.mjs";\n\nexport default [{ files: ["**/*.{ts,tsx,mts,cts}"] }, ...packageProjection, ...projection];\n';

const UNPROJECTING_PACKAGE_CONFIG = 'export default [{ files: ["**/*.{ts,tsx,mts,cts}"] }];\n';

const KEPT_CLASS = "export class Kept {}\n";

const KEPT_CONSTANT = "export const kept = 1;\n";

const ROOT_PROJECTION_CARVING_SRC =
  'import piece0 from "../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";\n\nexport default [\n  {\n    name: "hone-core/piece/hone",\n    files: ["**/*.{ts,tsx,mts,cts}"],\n    plugins: { "hone": piece0 },\n    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },\n  },\n  {\n    name: "hone-core/file-records/CD-14#class-syntax",\n    files: [\n      "src/kept.ts",\n    ],\n    rules: { "hone/no-class-authoring": "off" },\n  },\n];\n';

const ROOT_PROJECTION =
  'import piece0 from "../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";\n\nexport default [\n  {\n    name: "hone-core/piece/hone",\n    files: ["**/*.{ts,tsx,mts,cts}"],\n    plugins: { "hone": piece0 },\n    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },\n  },\n];\n';

const ROOT_PROJECTION_CARVING_PACKAGE =
  'import piece0 from "../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";\n\nexport default [\n  {\n    name: "hone-core/piece/hone",\n    files: ["**/*.{ts,tsx,mts,cts}"],\n    plugins: { "hone": piece0 },\n    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },\n  },\n  {\n    name: "hone-core/file-records/CD-14#class-syntax",\n    files: [\n      "packages/a/kept.ts",\n    ],\n    rules: { "hone/no-class-authoring": "off" },\n  },\n];\n';

const ROOT_PROJECTION_CARVING_ROOT =
  'import piece0 from "../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";\n\nexport default [\n  {\n    name: "hone-core/piece/hone",\n    files: ["**/*.{ts,tsx,mts,cts}"],\n    plugins: { "hone": piece0 },\n    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },\n  },\n  {\n    name: "hone-core/file-records/CD-14#class-syntax",\n    files: [\n      "kept.ts",\n    ],\n    rules: { "hone/no-class-authoring": "off" },\n  },\n];\n';

const PACKAGE_PROJECTION_CARVING =
  'import piece0 from "../../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";\n\nexport default [\n  {\n    name: "hone-core/piece/hone",\n    files: ["**/*.{ts,tsx,mts,cts}"],\n    plugins: { "hone": piece0 },\n    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },\n  },\n  {\n    name: "hone-core/file-records/CD-14#class-syntax",\n    files: [\n      "kept.ts",\n    ],\n    rules: { "hone/no-class-authoring": "off" },\n  },\n];\n';

const PACKAGE_PROJECTION =
  'import piece0 from "../../../../src/infrastructure/engines/eslint/authored-class-or-this/class-keyword/eslint-plugin.ts";\n\nexport default [\n  {\n    name: "hone-core/piece/hone",\n    files: ["**/*.{ts,tsx,mts,cts}"],\n    plugins: { "hone": piece0 },\n    rules: { "hone/no-class-authoring": "error", "hone/no-extraneous-class": ["error",{"allowConstructorOnly":true,"allowEmpty":true,"allowStaticOnly":false,"allowWithDecorator":true}] },\n  },\n];\n';

const UPGRADED_ROOT =
  "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax src/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: records written 1, carried records removed 0, debt recorded 0, debt pruned 0; version 2's check passes\n";

const CHECKED_ROOT =
  "answered (1)\nauthored-class-or-this#class-keyword eslint src/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n";

const REFUSED_IGNORED_DECLARATIONS =
  "upgrade refused:\nversion 2's check fails on the upgraded repository:\n  unrecorded (2)\n  authored-class-or-this#class-keyword eslint ignore hone.eslint.d.mts\n  authored-class-or-this#static-members-only eslint ignore hone.eslint.d.mts\nFix what it reports, then run the upgrade again.\nNothing was changed.\n";

const UPGRADED_PACKAGE =
  "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nwrote hone.eslint.d.mts\nwrote packages/a/hone.eslint.d.mts\nrewrote eslint.config.mjs\nrewrote packages/a/eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax packages/a/kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: records written 1, carried records removed 0, debt recorded 0, debt pruned 0; version 2's check passes\n";

const CHECKED_PACKAGE =
  "answered (1)\nauthored-class-or-this#class-keyword eslint packages/a/kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n";

const UPGRADED_DECLARED =
  "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/debt/authored-class-or-this.json\nwrote hone.eslint.mjs\nwrote packages/a/hone.eslint.mjs\nwrote hone.eslint.d.mts\nwrote packages/a/hone.eslint.d.mts\nrewrote eslint.config.mjs\nremoved discipline-exceptions.json\nremoved disciplines.eslint.mjs\nremoved packages/a/disciplines.eslint.mjs\nremoved disciplines.json\nfile-carve-out CD-14#class-syntax kept.ts -> debt authored-class-or-this#class-keyword\nupgrade: records written 1, carried records removed 0, debt recorded 0, debt pruned 0; version 2's check passes\n";

const CHECKED_DECLARED =
  "answered (1)\nauthored-class-or-this#class-keyword eslint kept.ts:1:7 export class Kept {} answered by debt\nassessment (1)\nforfeiture elsewhere: 1 debt record not checked for forfeiture in this run\nverdict: pass (partial assessment)\n";

const DECLARED_CONFIGURATION =
  '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "authored-class-or-this#class-keyword": "eslint",\n    "authored-class-or-this#static-members-only": "eslint"\n  },\n  "eslintConfigRoots": [\n    "packages/a"\n  ],\n  "eslintConfigLookup": "repository-root"\n}\n';

const PACKAGE_TRACKED =
  "eslint.config.mjs\nhone-records/debt/authored-class-or-this.json\nhone.config.json\nhone.eslint.d.mts\nhone.eslint.mjs\npackages/a/eslint.config.mjs\npackages/a/hone.eslint.d.mts\npackages/a/hone.eslint.mjs\npackages/a/kept.ts\n";

const DECLARED_TRACKED =
  "eslint.config.mjs\nhone-records/debt/authored-class-or-this.json\nhone.config.json\nhone.eslint.d.mts\nhone.eslint.mjs\nkept.ts\npackages/a/eslint.config.mjs\npackages/a/hone.eslint.d.mts\npackages/a/hone.eslint.mjs\npackages/a/kept.ts\n";

const CLAUSE_WIDE_SELECTION =
  '{ "version": 1, "ruleSets": {}, "clauses": { "CD-19#import-boundaries": "walker" }, "clauseSettings": { "CD-19#import-boundaries": { "confinedPackages": ["uuid"] } } }';

const CLAUSE_WIDE_RECORDS =
  '{ "version": 1, "exceptions": [{ "kind": "clause-wide-carve-out", "clause": "CD-19#import-boundaries", "reason": "the imports predate the boundary", "whyChain": { "whys": [{ "why": "Why import it?", "because": "it is the adapter", "evidence": "src/ids.ts:1" }, { "why": "Why an adapter?", "because": "the port needs one", "evidence": "src/ids.ts:1" }, { "why": "Why one?", "because": "each party has one wrapper", "evidence": "src/ids.ts:1" }, { "why": "Why one wrapper?", "because": "a swap touches one file", "evidence": "src/ids.ts:1" }, { "why": "Why swap?", "because": "parties change on their own", "evidence": "src/ids.ts:1" }], "rootCause": "an outside party needs exactly one adapter", "owner": "ids-team" } }, { "kind": "file-carve-out", "clause": "CD-19#import-boundaries", "file": "src/held.ts", "reason": "the old import" }, { "kind": "authorised-location", "clause": "CD-19#import-boundaries", "file": "src/ids.ts", "reason": "the uuid adapter", "whyChain": { "whys": [{ "why": "Why import it?", "because": "it is the adapter", "evidence": "src/ids.ts:1" }, { "why": "Why an adapter?", "because": "the port needs one", "evidence": "src/ids.ts:1" }, { "why": "Why one?", "because": "each party has one wrapper", "evidence": "src/ids.ts:1" }, { "why": "Why one wrapper?", "because": "a swap touches one file", "evidence": "src/ids.ts:1" }, { "why": "Why swap?", "because": "parties change on their own", "evidence": "src/ids.ts:1" }], "rootCause": "an outside party needs exactly one adapter", "owner": "ids-team" } }] }';

const UUID_IMPORT = 'import { v4 } from "uuid";\n\nexport const createId = v4;\n';

const UPGRADED_CLAUSE_WIDE =
  "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/authorised-locations/outside-import-past-a-boundary.json\nwrote hone-records/debt/outside-import-past-a-boundary.json\nremoved discipline-exceptions.json\nremoved disciplines.json\nclause-wide-carve-out CD-19#import-boundaries -> debt for each file with a finding; owner: ids-team; reason: the imports predate the boundary\nfile-carve-out CD-19#import-boundaries src/held.ts -> debt outside-import-past-a-boundary#import-or-require\nauthorised-location CD-19#import-boundaries src/ids.ts -> authorised-location outside-import-past-a-boundary#import-or-require for uuid\nauthorised-location CD-19#import-boundaries src/ids.ts -> authorised-location outside-import-past-a-boundary#import-or-require for node:\ncarried outside-import-past-a-boundary#import-or-require src/ids.ts\ncarried outside-import-past-a-boundary#import-or-require src/ids.ts\nremoved outside-import-past-a-boundary#import-or-require authorised-location src/ids.ts for node: carried: it answers nothing\noutside-import-past-a-boundary#import-or-require recorded src/wide.ts\nupgrade: records written 3, carried records removed 1, debt recorded 1, debt pruned 0; version 2's check passes\n";

const CLAUSE_WIDE_CONFIGURATION =
  '{\n  "version": 2,\n  "ruleSets": {},\n  "checks": {\n    "outside-import-past-a-boundary#import-or-require": "walker"\n  },\n  "checkSettings": {\n    "outside-import-past-a-boundary#import-or-require": {\n      "confinedOutsideDependencies": [\n        "uuid"\n      ]\n    }\n  }\n}\n';

const CLAUSE_WIDE_DEBT =
  '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "outside-import-past-a-boundary#import-or-require",\n      "file": "src/held.ts",\n      "note": "the old import"\n    },\n    {\n      "answers": "outside-import-past-a-boundary#import-or-require",\n      "file": "src/wide.ts"\n    }\n  ]\n}\n';

const CHECKED_CLAUSE_WIDE =
  "answered (3)\noutside-import-past-a-boundary#import-or-require walker src/held.ts:1:0 banned third-party import: uuid — use its recorded wrapping boundary answered by debt\noutside-import-past-a-boundary#import-or-require walker src/ids.ts:1:0 banned third-party import: uuid — use its recorded wrapping boundary answered by authorised-location for uuid carried\noutside-import-past-a-boundary#import-or-require walker src/wide.ts:1:0 banned third-party import: uuid — use its recorded wrapping boundary answered by debt\ncarried (1)\nhone-records/authorised-locations/outside-import-past-a-boundary.json records[0] established lacks case, owes, whyChain\nverdict: pass\n";

const NOTHING_TO_UPGRADE = "already on version 2; nothing to upgrade\n";

const runCommandIn = async (request: {
  readonly repo: string;
  readonly subcommand: Subcommand;
  readonly options: readonly string[];
  readonly engines: RunnerEngines;
}) => {
  const processPort: ProcessPort = {
    arguments: ["--repo", request.repo, ...request.options],
    writeOut: vi.fn<ProcessPort["writeOut"]>(),
    writeError: vi.fn<ProcessPort["writeError"]>(),
    exitWith: vi.fn<ProcessPort["exitWith"]>(),
  };
  const command: VersionOneCommandRequest = {
    process: processPort,
    path,
    fileText,
    modules: createDefaultModuleLoaderPort({}),
    git: createDefaultGitPort(),
    exceptionRepositoryOf: createDefaultExceptionRepositoryOf(),
    exceptionEntryParser,
    selectionRepositoryOf: createSelectionRepository,
    shownPathOfRepository,
    moduleUrl: ENTRY_URL,
  };
  const subcommands = toolSubcommandsOf({ ...INSTALLED_PORTS, ...command, ...request.engines });
  await subcommands[request.subcommand](command);
  return {
    writes: vi.mocked(processPort.writeOut).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

const ESLINT_10_SLICED = path.join({
  segments: [INSTALL_ROOT, "artefacts", "upgrade-command-sliced-eslint-10"],
});

const ESLINT_10_DECLARED = path.join({
  segments: [INSTALL_ROOT, "artefacts", "upgrade-command-declared-eslint-10"],
});

const ESLINT_9_SLICED = path.join({
  segments: [INSTALL_ROOT, "artefacts", "upgrade-command-sliced-eslint-9"],
});

const ESLINT_9_DECLARED = path.join({
  segments: [INSTALL_ROOT, "artefacts", "upgrade-command-declared-eslint-9"],
});

const ESLINT_LINES = [
  {
    line: "eslint-10",
    sliced: ESLINT_10_SLICED,
    declared: ESLINT_10_DECLARED,
    runnerModule: eslintRunnerModuleOver({
      toolchain: loadEslintToolchain({ peers: DEVELOPMENT_PEERS }),
      platform: {
        fileText,
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: createDefaultModuleLoaderPort({}),
        path,
        moduleExtension: ".ts",
      },
    }),
  },
  {
    line: "eslint-9",
    sliced: ESLINT_9_SLICED,
    declared: ESLINT_9_DECLARED,
    runnerModule: eslintRunnerModuleOver({
      toolchain: loadEslintToolchain({
        peers: { location: DEVELOPMENT_PEERS.location, modules: eslint9ToolchainModules },
      }),
      platform: {
        fileText,
        fileRemoval: createDefaultFileRemovalPort({}),
        modules: eslint9PieceModules({ base: createDefaultModuleLoaderPort({}) }),
        path,
        moduleExtension: ".ts",
      },
    }),
  },
];

const SLICED_MADE = [
  DONE,
  DONE,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  SUCCEEDED,
  SUCCEEDED,
];

const DECLARED_MADE = [
  DONE,
  DONE,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  WRITTEN,
  SUCCEEDED,
  SUCCEEDED,
];

const UPGRADED = path.join({ segments: [INSTALL_ROOT, "artefacts", "upgrade-command-upgraded"] });

const DRIFTED = path.join({ segments: [INSTALL_ROOT, "artefacts", "upgrade-command-drifted"] });

const MISSING = path.join({ segments: [INSTALL_ROOT, "artefacts", "upgrade-command-missing"] });

const DRIFTED_REFUSED = path.join({
  segments: [INSTALL_ROOT, "artefacts", "upgrade-command-drifted-refused"],
});

const MISSING_REFUSED = path.join({
  segments: [INSTALL_ROOT, "artefacts", "upgrade-command-missing-refused"],
});

const IGNORED = path.join({ segments: [INSTALL_ROOT, "artefacts", "upgrade-command-ignored"] });

afterAll(() => {
  scratch.removeTree({ path: UPGRADED });
  scratch.removeTree({ path: IGNORED });
  scratch.removeTree({ path: DRIFTED });
  scratch.removeTree({ path: MISSING });
  scratch.removeTree({ path: DRIFTED_REFUSED });
  scratch.removeTree({ path: MISSING_REFUSED });
  scratch.removeTree({ path: ESLINT_10_SLICED });
  scratch.removeTree({ path: ESLINT_10_DECLARED });
  scratch.removeTree({ path: ESLINT_9_SLICED });
  scratch.removeTree({ path: ESLINT_9_DECLARED });
});

describe("hone upgrade over a real repository, through the real ports", () => {
  it("upgrades a version 1 repository, checks it with the projection current, and finds nothing left to upgrade", async () => {
    const repo = UPGRADED;
    const engines = INSTALLED_PORTS;
    expect([
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/src` }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
      fileText.write({ path: `${repo}/discipline-exceptions.json`, text: SRC_CARVE_OUT }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: ROOT_PROJECTION_CARVING_SRC }),
      fileText.write({ path: `${repo}/src/kept.ts`, text: KEPT_CLASS }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
    ]).toEqual([DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN, SUCCEEDED, SUCCEEDED]);
    expect([
      await runCommandIn({ repo, subcommand: "upgrade", options: [], engines }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      await runCommandIn({
        repo,
        subcommand: "check",
        options: ["--forfeiture", "elsewhere"],
        engines,
      }),
      await runCommandIn({ repo, subcommand: "upgrade", options: [], engines }),
    ]).toEqual([
      { writes: [[{ text: UPGRADED_ROOT }]], exits: [[{ code: 0 }]] },
      SUCCEEDED,
      { writes: [[{ text: CHECKED_ROOT }]], exits: [[{ code: 0 }]] },
      { writes: [[{ text: NOTHING_TO_UPGRADE }]], exits: [[{ code: 0 }]] },
    ]);
  });

  it("upgrades a version 1 repository whose projection has drifted, and leaves a repository that passes the check", async () => {
    const repo = DRIFTED;
    const engines = INSTALLED_PORTS;
    const made = [
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/src` }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
      fileText.write({ path: `${repo}/discipline-exceptions.json`, text: SRC_CARVE_OUT }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: ROOT_PROJECTION }),
      fileText.write({ path: `${repo}/src/kept.ts`, text: KEPT_CLASS }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
    ];

    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], engines });
    const added = commands.run({ command: "git", arguments: GIT_ADD, directory: repo });
    const checked = await runCommandIn({
      repo,
      subcommand: "check",
      options: ["--forfeiture", "elsewhere"],
      engines,
    });

    expect([made, upgraded, added, checked]).toEqual([
      [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN, SUCCEEDED, SUCCEEDED],
      { writes: [[{ text: UPGRADED_ROOT }]], exits: [[{ code: 0 }]] },
      SUCCEEDED,
      { writes: [[{ text: CHECKED_ROOT }]], exits: [[{ code: 0 }]] },
    ]);
  });

  it("upgrades a version 1 repository whose projection is missing, and leaves a repository that passes the check", async () => {
    const repo = MISSING;
    const engines = INSTALLED_PORTS;
    const made = [
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/src` }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
      fileText.write({ path: `${repo}/discipline-exceptions.json`, text: SRC_CARVE_OUT }),
      fileText.write({ path: `${repo}/eslint.config.mjs`, text: TEAM_CONFIG }),
      fileText.write({ path: `${repo}/src/kept.ts`, text: KEPT_CLASS }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
    ];

    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], engines });
    const added = commands.run({ command: "git", arguments: GIT_ADD, directory: repo });
    const checked = await runCommandIn({
      repo,
      subcommand: "check",
      options: ["--forfeiture", "elsewhere"],
      engines,
    });

    expect([made, upgraded, added, checked]).toEqual([
      [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, SUCCEEDED, SUCCEEDED],
      { writes: [[{ text: UPGRADED_ROOT }]], exits: [[{ code: 0 }]] },
      SUCCEEDED,
      { writes: [[{ text: CHECKED_ROOT }]], exits: [[{ code: 0 }]] },
    ]);
  });

  it("keeps the party record a file answers with, names the ones it removed, and leaves a check that passes", async () => {
    const repo = absolutePathSchema.parse(`${INSTALL_ROOT}/artefacts/upgrade-command-parties`);
    const upgrading: ProcessPort = {
      arguments: ["upgrade", "--repo", repo],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };
    const checking: ProcessPort = {
      arguments: ["check", "--repo", repo, "--base-revision", "HEAD"],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    scratch.removeTree({ path: repo });
    scratch.makeDirectory({ path: `${repo}/src` });
    fileText.write({
      path: `${repo}/disciplines.json`,
      text: '{ "version": 1, "ruleSets": {}, "clauses": { "CD-19#import-boundaries": "walker" }, "clauseSettings": { "CD-19#import-boundaries": { "confinedPackages": ["uuid", "winston"] } } }',
    });
    fileText.write({
      path: `${repo}/discipline-exceptions.json`,
      text: '{ "version": 1, "exceptions": [{ "kind": "authorised-location", "clause": "CD-19#import-boundaries", "file": "src/ids.ts", "reason": "the uuid adapter", "whyChain": { "whys": [{ "why": "Why import it?", "because": "it is the adapter", "evidence": "src/ids.ts:1" }, { "why": "Why an adapter?", "because": "the port needs one", "evidence": "src/ids.ts:1" }, { "why": "Why one?", "because": "each party has one wrapper", "evidence": "src/ids.ts:1" }, { "why": "Why one wrapper?", "because": "a swap touches one file", "evidence": "src/ids.ts:1" }, { "why": "Why swap?", "because": "parties change on their own", "evidence": "src/ids.ts:1" }], "rootCause": "an outside party needs exactly one adapter", "owner": "ids-team" } }] }',
    });
    fileText.write({
      path: `${repo}/src/ids.ts`,
      text: 'import { v4 } from "uuid";\n\nexport const createId = v4;\n',
    });
    commands.run({ command: "git", arguments: GIT_INIT, directory: repo });
    commands.run({ command: "git", arguments: GIT_ADD, directory: repo });
    commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo });

    await runToolCommand({ process: upgrading, moduleUrl: ENTRY_URL });
    const records = fileText.read({
      path: `${repo}/hone-records/authorised-locations/outside-import-past-a-boundary.json`,
    });
    await runToolCommand({ process: checking, moduleUrl: ENTRY_URL });

    expect({
      upgraded: vi.mocked(upgrading.writeOut).mock.calls,
      upgradeExits: vi.mocked(upgrading.exitWith).mock.calls,
      records,
      checkExits: vi.mocked(checking.exitWith).mock.calls,
    }).toEqual({
      upgraded: [
        [
          {
            text: "upgraded to version 2\nwrote hone.config.json\nwrote hone-records/authorised-locations/outside-import-past-a-boundary.json\nremoved discipline-exceptions.json\nremoved disciplines.json\nauthorised-location CD-19#import-boundaries src/ids.ts -> authorised-location outside-import-past-a-boundary#import-or-require for uuid\nauthorised-location CD-19#import-boundaries src/ids.ts -> authorised-location outside-import-past-a-boundary#import-or-require for winston\nauthorised-location CD-19#import-boundaries src/ids.ts -> authorised-location outside-import-past-a-boundary#import-or-require for node:\ncarried outside-import-past-a-boundary#import-or-require src/ids.ts\ncarried outside-import-past-a-boundary#import-or-require src/ids.ts\ncarried outside-import-past-a-boundary#import-or-require src/ids.ts\nremoved outside-import-past-a-boundary#import-or-require authorised-location src/ids.ts for winston carried: it answers nothing\nremoved outside-import-past-a-boundary#import-or-require authorised-location src/ids.ts for node: carried: it answers nothing\nupgrade: records written 3, carried records removed 2, debt recorded 0, debt pruned 0; version 2's check passes\n",
          },
        ],
      ],
      upgradeExits: [[{ code: 0 }]],
      records: {
        outcome: "ok",
        value:
          '{\n  "version": 2,\n  "records": [\n    {\n      "answers": "outside-import-past-a-boundary#import-or-require",\n      "file": "src/ids.ts",\n      "outsideParty": "uuid",\n      "carried": {\n        "kind": "authorised-location",\n        "clause": "CD-19#import-boundaries",\n        "file": "src/ids.ts",\n        "reason": "the uuid adapter",\n        "whyChain": {\n          "whys": [\n            {\n              "why": "Why import it?",\n              "because": "it is the adapter",\n              "evidence": "src/ids.ts:1"\n            },\n            {\n              "why": "Why an adapter?",\n              "because": "the port needs one",\n              "evidence": "src/ids.ts:1"\n            },\n            {\n              "why": "Why one?",\n              "because": "each party has one wrapper",\n              "evidence": "src/ids.ts:1"\n            },\n            {\n              "why": "Why one wrapper?",\n              "because": "a swap touches one file",\n              "evidence": "src/ids.ts:1"\n            },\n            {\n              "why": "Why swap?",\n              "because": "parties change on their own",\n              "evidence": "src/ids.ts:1"\n            }\n          ],\n          "rootCause": "an outside party needs exactly one adapter",\n          "owner": "ids-team"\n        }\n      }\n    }\n  ]\n}\n',
      },
      checkExits: [[{ code: 0 }]],
    });
  });

  it("records a clause-wide carve-out's findings as debt by file, and keeps the settings, the file carve-out and the authorised location on its clause, in a repository that passes the check at its version 1 base", async () => {
    const repo = `${INSTALL_ROOT}/artefacts/upgrade-command-clause-wide`;
    const engines = INSTALLED_PORTS;
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    scratch.removeTree({ path: repo });
    scratch.makeDirectory({ path: `${repo}/src` });
    fileText.write({ path: `${repo}/disciplines.json`, text: CLAUSE_WIDE_SELECTION });
    fileText.write({ path: `${repo}/discipline-exceptions.json`, text: CLAUSE_WIDE_RECORDS });
    fileText.write({ path: `${repo}/src/ids.ts`, text: UUID_IMPORT });
    fileText.write({ path: `${repo}/src/held.ts`, text: UUID_IMPORT });
    fileText.write({ path: `${repo}/src/wide.ts`, text: UUID_IMPORT });
    commands.run({ command: "git", arguments: GIT_INIT, directory: repo });
    commands.run({ command: "git", arguments: GIT_ADD, directory: repo });
    commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo });

    const upgraded = await runCommandIn({ repo, subcommand: "upgrade", options: [], engines });
    commands.run({ command: "git", arguments: GIT_ADD, directory: repo });
    commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo });
    const settings = fileText.read({ path: `${repo}/hone.config.json` });
    const debt = fileText.read({
      path: `${repo}/hone-records/debt/outside-import-past-a-boundary.json`,
    });
    const checked = await runCommandIn({
      repo,
      subcommand: "check",
      options: ["--base-revision", "HEAD~1"],
      engines,
    });

    expect({ upgraded, settings, debt, checked }).toEqual({
      upgraded: { writes: [[{ text: UPGRADED_CLAUSE_WIDE }]], exits: [[{ code: 0 }]] },
      settings: { outcome: "ok", value: CLAUSE_WIDE_CONFIGURATION },
      debt: { outcome: "ok", value: CLAUSE_WIDE_DEBT },
      checked: { writes: [[{ text: CHECKED_CLAUSE_WIDE }]], exits: [[{ code: 0 }]] },
    });
  });

  it("refuses when the team config ignores a file the upgrade writes, as checking the committed upgrade would, and changes nothing", async () => {
    const repo = IGNORED;
    expect([
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/src` }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
      fileText.write({ path: `${repo}/discipline-exceptions.json`, text: NO_RECORDS }),
      fileText.write({
        path: `${repo}/eslint.config.mjs`,
        text: TEAM_CONFIG_IGNORING_DECLARATIONS,
      }),
      fileText.write({ path: `${repo}/disciplines.eslint.mjs`, text: ROOT_PROJECTION }),
      fileText.write({ path: `${repo}/src/kept.ts`, text: KEPT_CONSTANT }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
    ]).toEqual([
      DONE,
      DONE,
      WRITTEN,
      WRITTEN,
      WRITTEN,
      WRITTEN,
      WRITTEN,
      SUCCEEDED,
      SUCCEEDED,
      SUCCEEDED,
    ]);
    expect([
      await runCommandIn({ repo, subcommand: "upgrade", options: [], engines: INSTALLED_PORTS }),
      commands.run({ command: "git", arguments: GIT_STATUS, directory: repo }),
    ]).toEqual([
      { writes: [[{ text: REFUSED_IGNORED_DECLARATIONS }]], exits: [[{ code: 1 }]] },
      UNCHANGED,
    ]);
  });

  it("puts back the drifted projection it regenerated when it refuses", async () => {
    const repo = DRIFTED_REFUSED;
    const made = [
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/src` }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
      fileText.write({ path: `${repo}/discipline-exceptions.json`, text: NO_RECORDS }),
      fileText.write({
        path: `${repo}/eslint.config.mjs`,
        text: TEAM_CONFIG_IGNORING_DECLARATIONS,
      }),
      fileText.write({
        path: `${repo}/disciplines.eslint.mjs`,
        text: ROOT_PROJECTION_CARVING_SRC,
      }),
      fileText.write({ path: `${repo}/src/kept.ts`, text: KEPT_CONSTANT }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
    ];

    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      engines: INSTALLED_PORTS,
    });
    const left = fileText.read({ path: `${repo}/disciplines.eslint.mjs` });
    const status = commands.run({ command: "git", arguments: GIT_STATUS, directory: repo });

    expect([made, refused, left, status]).toEqual([
      [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, WRITTEN, SUCCEEDED, SUCCEEDED, SUCCEEDED],
      { writes: [[{ text: REFUSED_IGNORED_DECLARATIONS }]], exits: [[{ code: 1 }]] },
      { outcome: "ok", value: ROOT_PROJECTION_CARVING_SRC },
      UNCHANGED,
    ]);
  });

  it("deletes the missing projection it created when it refuses", async () => {
    const repo = MISSING_REFUSED;
    const made = [
      scratch.removeTree({ path: repo }),
      scratch.makeDirectory({ path: `${repo}/src` }),
      fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
      fileText.write({ path: `${repo}/discipline-exceptions.json`, text: NO_RECORDS }),
      fileText.write({
        path: `${repo}/eslint.config.mjs`,
        text: TEAM_CONFIG_IGNORING_DECLARATIONS,
      }),
      fileText.write({ path: `${repo}/src/kept.ts`, text: KEPT_CONSTANT }),
      commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
      commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      commands.run({ command: "git", arguments: GIT_COMMIT, directory: repo }),
    ];

    const refused = await runCommandIn({
      repo,
      subcommand: "upgrade",
      options: [],
      engines: INSTALLED_PORTS,
    });
    const left = fileText.exists({ path: `${repo}/disciplines.eslint.mjs` });
    const status = commands.run({ command: "git", arguments: GIT_STATUS, directory: repo });

    expect([made, refused, left, status]).toEqual([
      [DONE, DONE, WRITTEN, WRITTEN, WRITTEN, WRITTEN, SUCCEEDED, SUCCEEDED, SUCCEEDED],
      { writes: [[{ text: REFUSED_IGNORED_DECLARATIONS }]], exits: [[{ code: 1 }]] },
      "absent",
      UNCHANGED,
    ]);
  });
});

describe.each(ESLINT_LINES)(
  "hone upgrade over a real repository whose ESLint slices are not only at the root, on $line",
  ({ sliced, declared, runnerModule }) => {
    it("carries a package slice to version 2, rewrites the package config to import it, and leaves a repository that checks the same", async () => {
      const repo = sliced;
      const engines = runnerEnginesOver({
        runnerModuleOf: vi
          .fn<RunnerModuleOf>()
          .mockResolvedValue({ outcome: "ok", value: runnerModule }),
      });
      expect([
        scratch.removeTree({ path: repo }),
        scratch.makeDirectory({ path: `${repo}/packages/a` }),
        fileText.write({ path: `${repo}/disciplines.json`, text: SELECTION }),
        fileText.write({ path: `${repo}/discipline-exceptions.json`, text: PACKAGE_CARVE_OUT }),
        fileText.write({ path: `${repo}/eslint.config.mjs`, text: TEAM_CONFIG }),
        fileText.write({
          path: `${repo}/disciplines.eslint.mjs`,
          text: ROOT_PROJECTION_CARVING_PACKAGE,
        }),
        fileText.write({ path: `${repo}/packages/a/eslint.config.mjs`, text: TEAM_CONFIG }),
        fileText.write({
          path: `${repo}/packages/a/disciplines.eslint.mjs`,
          text: PACKAGE_PROJECTION_CARVING,
        }),
        fileText.write({ path: `${repo}/packages/a/kept.ts`, text: KEPT_CLASS }),
        commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      ]).toEqual(SLICED_MADE);
      expect([
        await runCommandIn({ repo, subcommand: "upgrade", options: [], engines }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        await runCommandIn({
          repo,
          subcommand: "check",
          options: ["--forfeiture", "elsewhere"],
          engines,
        }),
        await runCommandIn({ repo, subcommand: "upgrade", options: [], engines }),
        commands.run({ command: "git", arguments: GIT_LIST, directory: repo }),
      ]).toEqual([
        { writes: [[{ text: UPGRADED_PACKAGE }]], exits: [[{ code: 0 }]] },
        SUCCEEDED,
        { writes: [[{ text: CHECKED_PACKAGE }]], exits: [[{ code: 0 }]] },
        { writes: [[{ text: NOTHING_TO_UPGRADE }]], exits: [[{ code: 0 }]] },
        { outcome: "exited", exitCode: 0, output: PACKAGE_TRACKED },
      ]);
    });

    it("carries a declared eslintConfigRoots folder under the repository-root lookup, and checks it with the same findings answered", async () => {
      const repo = declared;
      const engines = runnerEnginesOver({
        runnerModuleOf: vi
          .fn<RunnerModuleOf>()
          .mockResolvedValue({ outcome: "ok", value: runnerModule }),
      });
      expect([
        scratch.removeTree({ path: repo }),
        scratch.makeDirectory({ path: `${repo}/packages/a` }),
        fileText.write({ path: `${repo}/disciplines.json`, text: DECLARED_SELECTION }),
        fileText.write({ path: `${repo}/discipline-exceptions.json`, text: ROOT_CARVE_OUT }),
        fileText.write({
          path: `${repo}/eslint.config.mjs`,
          text: ROOT_CONFIG_IMPORTING_PACKAGE_SLICE,
        }),
        fileText.write({
          path: `${repo}/disciplines.eslint.mjs`,
          text: ROOT_PROJECTION_CARVING_ROOT,
        }),
        fileText.write({ path: `${repo}/kept.ts`, text: KEPT_CLASS }),
        fileText.write({
          path: `${repo}/packages/a/eslint.config.mjs`,
          text: UNPROJECTING_PACKAGE_CONFIG,
        }),
        fileText.write({
          path: `${repo}/packages/a/disciplines.eslint.mjs`,
          text: PACKAGE_PROJECTION,
        }),
        fileText.write({ path: `${repo}/packages/a/kept.ts`, text: KEPT_CONSTANT }),
        commands.run({ command: "git", arguments: GIT_INIT, directory: repo }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
      ]).toEqual(DECLARED_MADE);
      expect([
        await runCommandIn({ repo, subcommand: "upgrade", options: [], engines }),
        commands.run({ command: "git", arguments: GIT_ADD, directory: repo }),
        await runCommandIn({
          repo,
          subcommand: "check",
          options: ["--forfeiture", "elsewhere"],
          engines,
        }),
        fileText.read({ path: `${repo}/hone.config.json` }),
        commands.run({ command: "git", arguments: GIT_LIST, directory: repo }),
      ]).toEqual([
        { writes: [[{ text: UPGRADED_DECLARED }]], exits: [[{ code: 0 }]] },
        SUCCEEDED,
        { writes: [[{ text: CHECKED_DECLARED }]], exits: [[{ code: 0 }]] },
        { outcome: "ok", value: DECLARED_CONFIGURATION },
        { outcome: "exited", exitCode: 0, output: DECLARED_TRACKED },
      ]);
    });
  },
);
