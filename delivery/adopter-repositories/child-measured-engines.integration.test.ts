import { assert, describe, expect, it, onTestFinished, vi } from "vitest";

import type { NamedEngineRun } from "../../src/application/ports/engine/engine-run.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import { INSTALLED_PORTS, runToolCommand } from "../../src/composition/run-tool-command.ts";
import { repoPathOf } from "../../src/domain/repository/repo-path-of.ts";
import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultChildEnginesStage } from "../../src/infrastructure/engines/protocol/child-measurement/child-measurement.ts";
import { createDefaultDirectoryTreePort } from "../../src/infrastructure/node/file-system/directory-tree-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createDefaultCommandRunPort } from "../install-proof/install-proof-ports.ts";

const A_MEASURED: NamedEngineRun = {
  mechanism: "eslint",
  coverableKinds: ["config-override", "inline-disable"],
  projection: "current",
  slices: [],
  nestedConfigurations: [],
  unprojectedFolders: [],
  misnamedRuleIds: [],
  hits: [
    {
      check: "claimed-type#non-null-assertions",
      file: repoPathOf("a.ts"),
      anchor: { line: 1, column: 34 },
      snippet: "export const a = (b: string[]) => b[0]!;",
    },
  ],
  nativeExceptions: [],
  measured: [{ check: "claimed-type#non-null-assertions", file: repoPathOf("a.ts") }],
};

describe("an engines stage measured in a child process", () => {
  it("measures a projection rewritten in the same process, past Node's module cache", async () => {
    const check = "claimed-type#non-null-assertions";
    const fileText = createDefaultFileTextPort({});
    const commands = createDefaultCommandRunPort({});
    const installRoot = absolutePathSchema.parse(`${import.meta.dirname}/../..`);
    const repo = absolutePathSchema.parse(`${installRoot}/artefacts/child-measured-engines`);
    const cli: ProcessPort = {
      arguments: ["project", "--repo", repo],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };
    onTestFinished(() => {
      createDefaultDirectoryTreePort({}).remove({ path: repo });
    });
    commands.run({ command: "git", arguments: ["init", "--quiet", repo], directory: installRoot });
    fileText.write({
      path: `${repo}/hone.config.json`,
      text: `{"version":2,"ruleSets":{},"checks":{"${check}":"eslint"}}`,
    });
    fileText.write({
      path: `${repo}/eslint.config.mjs`,
      text: 'export { default } from "./hone.eslint.mjs";',
    });
    fileText.write({ path: `${repo}/a.ts`, text: "export const a = (b: string[]) => b[0]!;\n" });
    await runToolCommand({ process: cli, moduleUrl: import.meta.resolve("../../src/hone.ts") });
    commands.run({ command: "git", arguments: ["add", "--all"], directory: repo });
    const { path } = INSTALLED_PORTS;
    const located = { installRoot, repoRoot: repo, baseRevision: undefined };
    const engines = createDefaultChildEnginesStage({ ...located, path, moduleExtension: ".ts" });

    const tree = {
      tracked: [
        repoPathOf("a.ts"),
        repoPathOf("eslint.config.mjs"),
        repoPathOf("hone.config.json"),
        repoPathOf("hone.eslint.d.mts"),
        repoPathOf("hone.eslint.mjs"),
      ],
      declaredConfigRoots: [],
    };

    const before = await engines({ tree });
    fileText.write({ path: `${repo}/hone.eslint.mjs`, text: "export default [];" });
    const after = await engines({ tree });

    assert(before.outcome === "ok", "the projection as written is measured");
    assert(after.outcome === "ok", "the rewritten projection is measured");
    const [[first], [second]] = [before.value, after.value];
    assert(first !== undefined, "the projection as written has an ESLint run");
    assert(second !== undefined, "the rewritten projection has an ESLint run");
    expect({ before: first.nativeExceptions, after: second.nativeExceptions }).toEqual({
      before: [],
      after: [{ kind: "ignore", check, file: repoPathOf("a.ts") }],
    });
  });

  it("decodes the measurement while the adopter's config prints to standard output", async () => {
    const check = "claimed-type#non-null-assertions";
    const fileText = createDefaultFileTextPort({});
    const commands = createDefaultCommandRunPort({});
    const installRoot = absolutePathSchema.parse(`${import.meta.dirname}/../..`);
    const repo = absolutePathSchema.parse(
      `${installRoot}/artefacts/child-measured-engines-printing`,
    );
    const cli: ProcessPort = {
      arguments: ["project", "--repo", repo],
      writeOut: vi.fn<ProcessPort["writeOut"]>(),
      writeError: vi.fn<ProcessPort["writeError"]>(),
      exitWith: vi.fn<ProcessPort["exitWith"]>(),
    };
    onTestFinished(() => {
      createDefaultDirectoryTreePort({}).remove({ path: repo });
    });
    commands.run({ command: "git", arguments: ["init", "--quiet", repo], directory: installRoot });
    fileText.write({
      path: `${repo}/hone.config.json`,
      text: `{"version":2,"ruleSets":{},"checks":{"${check}":"eslint"}}`,
    });
    fileText.write({
      path: `${repo}/eslint.config.mjs`,
      text: 'console.log("adopter config loaded");\nexport { default } from "./hone.eslint.mjs";',
    });
    fileText.write({ path: `${repo}/a.ts`, text: "export const a = (b: string[]) => b[0]!;\n" });
    await runToolCommand({ process: cli, moduleUrl: import.meta.resolve("../../src/hone.ts") });
    commands.run({ command: "git", arguments: ["add", "--all"], directory: repo });
    const { path } = INSTALLED_PORTS;
    const located = { installRoot, repoRoot: repo, baseRevision: undefined };
    const engines = createDefaultChildEnginesStage({ ...located, path, moduleExtension: ".ts" });

    const measured = await engines({
      tree: {
        tracked: [
          repoPathOf("a.ts"),
          repoPathOf("eslint.config.mjs"),
          repoPathOf("hone.config.json"),
          repoPathOf("hone.eslint.d.mts"),
          repoPathOf("hone.eslint.mjs"),
        ],
        declaredConfigRoots: [],
      },
    });

    expect(measured).toEqual({
      outcome: "ok",
      value: [A_MEASURED],
    });
  });
});
