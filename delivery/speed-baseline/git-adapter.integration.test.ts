import { assert, describe, expect, it, onTestFinished, vi } from "vitest";

import { absolutePathSchema } from "../../src/infrastructure/content-files/absolute-path.ts";
import { createDefaultGitExecutionPort } from "../../src/infrastructure/git/git-port.ts";
import { createDefaultDirectoryTreePort } from "../../src/infrastructure/node/file-system/directory-tree-port.ts";
import { createDefaultDirectoryPort } from "../../src/infrastructure/node/file-system/file-system-port.ts";
import { createDefaultFileTextPort } from "../../src/infrastructure/node/file-system/file-text-port.ts";
import { createTemporaryDirectoryOutside } from "../../src/infrastructure/node/file-system/temporary-directory-port.ts";
import { createDefaultPathPort } from "../../src/infrastructure/node/path-port.ts";
import { createDefaultScratchFilesPort } from "../install-proof/install-proof-ports.ts";
import { createDirectoryRemovalPort } from "./directory-removal-adapter.ts";
import {
  createBaselineCheckoutPort,
  createTargetCopyPort,
  createTargetTreePort,
} from "./git-adapter.ts";
import type { HoneDependenciesPort } from "./hone-dependencies-port.ts";
import type { HonePackagePort } from "./hone-package-port.ts";
import { readTargetTree } from "./read-target-tree.ts";
import { removeTargetCopy } from "./remove-sample.ts";
import { removeSpeedSides } from "./speed-baseline-cleanup.ts";
import { createTemporaryFolderPort } from "./temporary-folder-adapter.ts";
import { writeTarballs } from "./write-tarballs.ts";

const EMPTY_COMMIT = [
  "-c",
  "commit.gpgSign=false",
  "-c",
  "core.hooksPath=.git/no-hooks",
  "-c",
  "user.name=proof",
  "-c",
  "user.email=proof@example.test",
  "commit",
  "--quiet",
  "--allow-empty",
  "-m",
  "base",
];

const scratch = createDefaultScratchFilesPort({});

const git = createDefaultGitExecutionPort({});

const path = createDefaultPathPort({});

const fileText = createDefaultFileTextPort({});

const directories = createDirectoryRemovalPort({ tree: createDefaultDirectoryTreePort({}) });

const copies = createTargetCopyPort({ git, path });

describe("readTargetTree, through real git", () => {
  it("snapshots a working-tree change while preserving the repository's index with split-index enabled", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    const source = path.join({ segments: [repo, "working.txt"] });
    git.run({ arguments: ["init", "--quiet", "--template="], cwd: repo });
    fileText.write({ path: source, text: "base" });
    git.run({
      arguments: ["-c", "core.splitIndex=false", "add", "--force", "working.txt"],
      cwd: repo,
    });
    git.run({ arguments: ["-c", "core.splitIndex=false", ...EMPTY_COMMIT], cwd: repo });
    const configured = git.run({
      arguments: ["config", "--local", "core.splitIndex", "true"],
      cwd: repo,
    });
    expect(configured).toMatchObject({ outcome: "ok", value: { status: 0 } });
    fileText.write({ path: source, text: "changed" });
    const hostDirectories = createDefaultDirectoryPort({});
    const hashIndex = () =>
      git.run({ arguments: ["hash-object", "--no-filters", ".git/index"], cwd: repo });
    const previous = hashIndex();
    const ports = {
      temporaryFolders: createTemporaryFolderPort({
        path,
        directories: hostDirectories,
        allocateOutside: createTemporaryDirectoryOutside,
      }),
      directories,
      trees: createTargetTreePort({ git, path, createGit: createDefaultGitExecutionPort }),
    };

    const snapshot = readTargetTree({ ports, repo });

    assert(snapshot.tree.outcome === "ok");
    const contents = git.run({
      arguments: ["show", `${snapshot.tree.value}:working.txt`],
      cwd: repo,
    });
    const gitDirectory = absolutePathSchema.parse(path.join({ segments: [repo, ".git"] }));
    const entries = hostDirectories.list({ path: gitDirectory });
    expect(contents).toMatchObject({ outcome: "ok", value: { status: 0, stdout: "changed" } });
    expect(previous).toMatchObject({ outcome: "ok", value: { status: 0 } });
    expect(hashIndex()).toEqual(previous);
    expect(snapshot.leftovers).toEqual([]);
    expect(entries.outcome).toBe("ok");
    expect(entries).not.toMatchObject({
      value: expect.arrayContaining([
        expect.objectContaining({ name: expect.stringMatching(/^sharedindex\./) }),
      ]),
    });
  });
});

describe("a worktree already at the baseline checkout's fixed place, through real git", () => {
  it("survives a refused checkout and the clean-up after it", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const checkouts = createBaselineCheckoutPort({ git, path, repository: repo });
    const place = checkouts.read({ revision: "HEAD" });
    assert(place.outcome === "ok", "the checkout's place is named");
    checkouts.write({ revision: "HEAD", directory: place.value });
    fileText.write({ path: `${place.value}/kept.txt`, text: "kept" });
    const before = git.run({ arguments: ["worktree", "list", "--porcelain"], cwd: repo });

    const run = writeTarballs({
      ports: {
        checkouts,
        dependencies: { write: vi.fn<HoneDependenciesPort["write"]>() },
        packages: { write: vi.fn<HonePackagePort["write"]>() },
      },
      revision: "HEAD",
      headRoot: repo,
      mode: "compare",
    });
    const ports = { copies, checkouts, directories };
    const leftovers = removeSpeedSides({ ports, repo, installs: [], checkouts: run.checkouts });

    const after = git.run({ arguments: ["worktree", "list", "--porcelain"], cwd: repo });
    const kept = fileText.read({ path: `${place.value}/kept.txt` });
    const output = expect.stringContaining("already exists");
    const command = { kind: "exited", status: 128, output };
    expect({ run, leftovers, after, kept }).toEqual({
      run: {
        checkouts: [],
        tarballs: {
          outcome: "failed",
          error: { side: "baseline", failure: { kind: "baseline-unchecked-out", command } },
        },
      },
      leftovers: [],
      after: before,
      kept: { outcome: "ok", value: "kept" },
    });
  });

  it("survives, locked, a refused checkout and the clean-up after it", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const checkouts = createBaselineCheckoutPort({ git, path, repository: repo });
    const place = checkouts.read({ revision: "HEAD" });
    assert(place.outcome === "ok", "the checkout's place is named");
    checkouts.write({ revision: "HEAD", directory: place.value });
    fileText.write({ path: `${place.value}/kept.txt`, text: "kept" });
    git.run({ arguments: ["worktree", "lock", place.value], cwd: repo });
    const before = git.run({ arguments: ["worktree", "list", "--porcelain"], cwd: repo });

    const run = writeTarballs({
      ports: {
        checkouts,
        dependencies: { write: vi.fn<HoneDependenciesPort["write"]>() },
        packages: { write: vi.fn<HonePackagePort["write"]>() },
      },
      revision: "HEAD",
      headRoot: repo,
      mode: "compare",
    });
    const ports = { copies, checkouts, directories };
    const leftovers = removeSpeedSides({ ports, repo, installs: [], checkouts: run.checkouts });

    const after = git.run({ arguments: ["worktree", "list", "--porcelain"], cwd: repo });
    const kept = fileText.read({ path: `${place.value}/kept.txt` });
    const output = expect.stringContaining("already exists");
    const command = { kind: "exited", status: 128, output };
    expect({ run, leftovers, after, kept }).toEqual({
      run: {
        checkouts: [],
        tarballs: {
          outcome: "failed",
          error: { side: "baseline", failure: { kind: "baseline-unchecked-out", command } },
        },
      },
      leftovers: [],
      after: before,
      kept: { outcome: "ok", value: "kept" },
    });
  });
});

describe("createTargetCopyPort write, through real git", () => {
  it("accepts an empty folder at the side's fixed place", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const place = copies.read({ repo, place: { kind: "install", side: "baseline" } });
    assert(place.outcome === "ok", "the side's place is named");
    scratch.makeDirectory({ path: place.value });

    const written = copies.write({ repo, directory: place.value });

    expect(written).toEqual({ outcome: "ok", value: null });
  });

  it("refuses a place that already holds a worktree", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const place = copies.read({ repo, place: { kind: "install", side: "baseline" } });
    assert(place.outcome === "ok", "the side's place is named");
    copies.write({ repo, directory: place.value });

    const written = copies.write({ repo, directory: place.value });

    expect(written).toEqual({
      outcome: "failed",
      error: {
        kind: "target-uncopied",
        command: {
          kind: "exited",
          status: 128,
          output: expect.stringContaining("already exists"),
        },
      },
    });
  });

  it("refuses a registered worktree whose folder is gone", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const place = copies.read({ repo, place: { kind: "install", side: "baseline" } });
    assert(place.outcome === "ok", "the side's place is named");
    copies.write({ repo, directory: place.value });
    scratch.removeTree({ path: place.value });

    const written = copies.write({ repo, directory: place.value });

    expect(written).toEqual({
      outcome: "failed",
      error: {
        kind: "target-uncopied",
        command: {
          kind: "exited",
          status: 128,
          output: expect.stringContaining("missing but already registered"),
        },
      },
    });
  });
});

describe("removeTargetCopy, through real git", () => {
  it("removes a worktree and its untracked files", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const place = copies.read({ repo, place: { kind: "install", side: "baseline" } });
    assert(place.outcome === "ok", "the side's place is named");
    copies.write({ repo, directory: place.value });
    fileText.write({ path: `${place.value}/kept.txt`, text: "kept" });

    const leftovers = removeTargetCopy({ ports: { copies, directories }, repo, copy: place.value });

    expect({ leftovers, kept: fileText.exists({ path: `${place.value}/kept.txt` }) }).toEqual({
      leftovers: [],
      kept: "absent",
    });
  });

  it("keeps the folder of a worktree git holds locked, reporting the one leftover", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const place = copies.read({ repo, place: { kind: "install", side: "baseline" } });
    assert(place.outcome === "ok", "the side's place is named");
    copies.write({ repo, directory: place.value });
    fileText.write({ path: `${place.value}/kept.txt`, text: "kept" });
    git.run({ arguments: ["worktree", "lock", place.value], cwd: repo });

    const leftovers = removeTargetCopy({ ports: { copies, directories }, repo, copy: place.value });

    expect({ leftovers, kept: fileText.read({ path: `${place.value}/kept.txt` }) }).toEqual({
      leftovers: [
        {
          kind: "target-copy-unremoved",
          directory: place.value,
          command: { kind: "exited", status: 128, output: expect.stringContaining("locked") },
        },
      ],
      kept: { outcome: "ok", value: "kept" },
    });
  });

  it("removes the folder of a worktree git has let go", () => {
    const made = scratch.createTemporaryDirectory({ prefix: "hone-speed-" });
    assert(made.outcome === "ok", "the scratch folder is made");
    const repo = absolutePathSchema.parse(made.value);
    onTestFinished(() => {
      scratch.removeTree({ path: repo });
    });
    git.run({ arguments: ["init", "--quiet"], cwd: repo });
    git.run({ arguments: EMPTY_COMMIT, cwd: repo });
    const place = copies.read({ repo, place: { kind: "install", side: "baseline" } });
    assert(place.outcome === "ok", "the side's place is named");
    copies.write({ repo, directory: place.value });
    fileText.write({ path: `${place.value}/kept.txt`, text: "kept" });
    scratch.removeTree({ path: path.join({ segments: [repo, ".git", "worktrees"] }) });

    const leftovers = removeTargetCopy({ ports: { copies, directories }, repo, copy: place.value });

    expect({ leftovers, kept: fileText.exists({ path: `${place.value}/kept.txt` }) }).toEqual({
      leftovers: [],
      kept: "absent",
    });
  });
});
