import { describe, expect, it, vi } from "vitest";

import type { FileTextPort } from "../../src/application/ports/file-system/file-text-port.ts";
import type { CommitRecord, GitHistoryPort } from "../../src/application/ports/git-port.ts";
import type { ProcessPort } from "../../src/application/ports/host/process-port.ts";
import { createPathPort } from "../../src/infrastructure/node/path-port.ts";
import { runReleasePullRequest } from "./release-pull-request.ts";

const MODULE_URL = "file:///repo/delivery/release/release-pull-request-command.ts";

const CHANGELOG = "# Changelog\n\nIntro.\n\n## 0.1.0-pre.3\n\n### Fixes\n\n- stage releases\n";

const MANIFEST = '{\n  "version": "0.1.0-pre.3",\n  "private": true\n}\n';

const TAGS = ["v0.1.0-pre.1", "v0.1.0-pre.3", "v0.1.0-pre.2", "backup-pre1-before-rewrite"];

const COMMITS = [
  { parentCount: 1, message: "feat(release): prepare release pull requests (#33)\n\nBody." },
  { parentCount: 1, message: "Keep versions out of the docs (#20)" },
];

const processWith = (request: { readonly arguments: readonly string[] }): ProcessPort => ({
  arguments: request.arguments,
  writeOut: vi.fn<ProcessPort["writeOut"]>(),
  writeError: vi.fn<ProcessPort["writeError"]>(),
  exitWith: vi.fn<ProcessPort["exitWith"]>(),
});

type CommitsAfter = ReturnType<GitHistoryPort["commitsAfter"]>;

const historyWith = (request: {
  readonly tags: ReturnType<GitHistoryPort["mergedTags"]>;
  readonly commits: CommitsAfter;
  readonly lineCommits: CommitsAfter;
}): GitHistoryPort => ({
  mergedTags: vi.fn<GitHistoryPort["mergedTags"]>().mockReturnValue(request.tags),
  commitsAfter: vi
    .fn<GitHistoryPort["commitsAfter"]>()
    .mockReturnValueOnce(request.commits)
    .mockReturnValue(request.lineCommits),
});

const runWith = (request: {
  readonly arguments?: readonly string[];
  readonly files?: Readonly<Record<string, string>>;
  readonly tags?: ReturnType<GitHistoryPort["mergedTags"]>;
  readonly commits?: CommitsAfter;
  readonly lineCommits?: CommitsAfter;
  readonly unwritablePaths?: readonly string[];
}) => {
  const processPort = processWith({ arguments: request.arguments ?? [] });
  const files = new Map(
    Object.entries(
      request.files ?? { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": MANIFEST },
    ),
  );
  const fileText: FileTextPort = {
    read: ({ path }) => {
      const text = files.get(path);
      return text === undefined
        ? { outcome: "failed", error: { kind: "unreadable", path, detail: "ENOENT" } }
        : { outcome: "ok", value: text };
    },
    exists: ({ path }) => (files.has(path) ? "present" : "absent"),
    write: ({ path, text }) => {
      if (request.unwritablePaths?.includes(path) === true) {
        return { outcome: "failed", error: { kind: "unwritable", path, detail: "EACCES" } };
      }
      files.set(path, text);
      return { outcome: "ok", value: undefined };
    },
  };
  const commits = request.commits ?? { outcome: "ok", value: COMMITS };
  const history = historyWith({
    tags: request.tags ?? { outcome: "ok", value: TAGS },
    commits,
    lineCommits: request.lineCommits ?? commits,
  });
  runReleasePullRequest({
    process: processPort,
    path: createPathPort({ flavour: "posix", workingDirectory: () => "/elsewhere" }),
    fileText,
    history,
    moduleUrl: MODULE_URL,
  });
  return {
    history,
    texts: Object.fromEntries(files),
    writes: vi.mocked(processPort.writeOut).mock.calls,
    errors: vi.mocked(processPort.writeError).mock.calls,
    exits: vi.mocked(processPort.exitWith).mock.calls,
  };
};

const UNCHANGED = { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": MANIFEST };

describe("runReleasePullRequest preparing a release", () => {
  it("reads the subjects merged since the latest release tag, and since the release its line is sized from, at the repository root", () => {
    const run = runWith({});

    expect(vi.mocked(run.history.mergedTags).mock.calls).toEqual([
      [{ repoRoot: "/repo", pattern: "v*" }],
    ]);
    expect(vi.mocked(run.history.commitsAfter).mock.calls).toEqual([
      [{ repoRoot: "/repo", revision: "v0.1.0-pre.3" }],
      [{ repoRoot: "/repo", revision: "v0.1.0-pre.1" }],
    ]);
  });

  it("writes the next pre-release's section into the changelog and its version into package.json, and says it made no tag", () => {
    const run = runWith({});

    expect(run.texts).toEqual({
      "/repo/CHANGELOG.md":
        "# Changelog\n\nIntro.\n\n## 0.1.0-pre.4\n\n### Features\n\n- release: prepare release pull requests (#33)\n\n### Other changes\n\n- Keep versions out of the docs (#20)\n\n## 0.1.0-pre.3\n\n### Fixes\n\n- stage releases\n",
      "/repo/package.json": '{\n  "version": "0.1.0-pre.4",\n  "private": true\n}\n',
    });
    expect(run.writes).toEqual([
      [
        {
          text: "release-pull-request: 0.1.0-pre.3 to 0.1.0-pre.4, a minor change on the pre-release channel, sized from 2 subjects since v0.1.0-pre.1, with 2 subjects since v0.1.0-pre.3 in its section. CHANGELOG.md and package.json are updated in the working tree; no tag was made and nothing was published.\n",
        },
      ],
    ]);
    expect(run.exits).toEqual([[{ code: 0 }]]);
  });

  it("warns about each subject that is not conventional, which it lists as a patch under other changes", () => {
    expect(runWith({}).errors).toEqual([
      [
        {
          text: 'release-pull-request: "Keep versions out of the docs (#20)" is not a conventional subject; it is listed under Other changes and counted as a patch.\n',
        },
      ],
    ]);
  });

  it("warns that a subject that is not conventional but carries a breaking footer counts as a major", () => {
    const run = runWith({
      commits: {
        outcome: "ok",
        value: [
          {
            parentCount: 1,
            message: "Squashed without a conventional title\n\nBREAKING CHANGE: renamed a key",
          },
        ],
      },
    });

    expect(run.errors).toEqual([
      [
        {
          text: 'release-pull-request: "Squashed without a conventional title" is not a conventional subject; it is listed under Breaking changes and counted as a major.\n',
        },
      ],
    ]);
    expect(run.texts["/repo/package.json"]).toBe(
      '{\n  "version": "1.0.0-pre.1",\n  "private": true\n}\n',
    );
  });

  it("counts a single subject in the singular", () => {
    expect(
      runWith({ commits: { outcome: "ok", value: [{ parentCount: 1, message: "fix: one" }] } })
        .writes,
    ).toEqual([
      [
        {
          text: "release-pull-request: 0.1.0-pre.3 to 0.1.0-pre.4, a patch change on the pre-release channel, sized from 1 subject since v0.1.0-pre.1, with 1 subject since v0.1.0-pre.3 in its section. CHANGELOG.md and package.json are updated in the working tree; no tag was made and nothing was published.\n",
        },
      ],
    ]);
  });

  it("finishes a pre-release on the stable channel when asked", () => {
    const run = runWith({ arguments: ["stable"] });

    expect(run.texts["/repo/package.json"]).toBe(
      '{\n  "version": "0.1.0",\n  "private": true\n}\n',
    );
    expect(run.texts["/repo/CHANGELOG.md"]).toContain("## 0.1.0\n");
  });
});

const squashed = (message: string): CommitRecord => ({ parentCount: 1, message });

const COMMITS_SINCE_PRE_5 = [
  squashed(
    "fix: reserve not-adopted from mechanism ids and make its refusals say what to do (#85)",
  ),
  squashed(
    "fix: name every missing ESLint peer, the broken ESLint config and its fix, and cap report snippets (#83)",
  ),
  squashed(
    "build(deps): bump zod from 4.4.3 to 4.6.6 in the npm_and_yarn group across 1 directory (#54)",
  ),
  squashed("docs: give every rule a spirit page and move check mechanics to CHECKS.md (#87)"),
  squashed("docs: an assessment of what each high-count clause means, written at adoption (#90)"),
  squashed(
    "feat!: let a clause be adopted with its mechanism not run, and remove assessment.waivedClauses and --waived-clauses (#92)",
  ),
  squashed(
    "fix(eslint): treat files under a broken nested ESLint config that a governing config ignores as ignored, as the team's ESLint does (#91)",
  ),
  squashed(
    "feat: point each failing clause at its assessment section and its rule's Spirit at the end of a red check (#93)",
  ),
  squashed(
    "feat(eslint)!: write a projection slice per config root, with core-validated eslintConfigRoots (#86)",
  ),
  squashed("fix: say why a check could not measure and what to run next (#94)"),
  squashed(
    "feat(cli)!: add --help and --version, word argument errors for the person typing, and document every printed line in a tested output contract (#96)",
  ),
  squashed("docs: state how config files and clause mechanisms change across versions (#108)"),
  squashed("test: install every install-proof consumer with pnpm (#105)"),
  squashed(
    "feat!: let file records hold inline disables and TypeScript directives, and judge lint-script options by effect (#97)",
  ),
  squashed(
    "feat(eslint)!: add CD-2#non-null-assertions for non-null and definite assignment assertions (#109)",
  ),
  squashed("chore: release 0.1.0-pre.6 (#111)"),
  squashed(
    "ci(release): release on merge of the release pull request instead of a hand-pushed tag (#116)",
  ),
  squashed(
    "feat: export folderScope and an experimental testing entry so a team can test its audit pieces from the package (#117)",
  ),
  squashed("chore: release 0.1.0-pre.7 (#119)"),
];

const SIZING_CHANGE = squashed("ci(release): size every release by plain semver (#120)");

const manifestAt = (request: { readonly version: string }): string =>
  `{\n  "version": "${request.version}",\n  "private": true\n}\n`;

const filesAt = (request: { readonly version: string }): Readonly<Record<string, string>> => ({
  "/repo/CHANGELOG.md": `# Changelog\n\n## ${request.version}\n\n### Fixes\n\n- an earlier fix\n`,
  "/repo/package.json": manifestAt(request),
});

describe("runReleasePullRequest finishing the 0.1.0 pre-release line", () => {
  const runFromPre7 = (request: { readonly arguments: readonly string[] }) =>
    runWith({
      arguments: request.arguments,
      files: filesAt({ version: "0.1.0-pre.7" }),
      tags: { outcome: "ok", value: ["v0.1.0-pre.5", "v0.1.0-pre.6", "v0.1.0-pre.7"] },
      commits: { outcome: "ok", value: [SIZING_CHANGE] },
      lineCommits: { outcome: "ok", value: [...COMMITS_SINCE_PRE_5, SIZING_CHANGE] },
    });

  it("releases 1.0.0 when asked for the stable release, since the line holds breaking changes", () => {
    const run = runFromPre7({ arguments: ["stable"] });

    expect(run).toMatchObject({
      texts: {
        "/repo/CHANGELOG.md":
          "# Changelog\n\n## 1.0.0\n\n### Fixes\n\n- an earlier fix\n\n### Other changes\n\n- release: size every release by plain semver (#120)\n",
        "/repo/package.json": manifestAt({ version: "1.0.0" }),
      },
      writes: [
        [
          {
            text: "release-pull-request: 0.1.0-pre.7 to 1.0.0, a major change on the stable channel, sized from 20 subjects since v0.1.0-pre.5, with 1 subject since v0.1.0-pre.7 and 1 entry folded from its pre-releases in its section. CHANGELOG.md and package.json are updated in the working tree; no tag was made and nothing was published.\n",
          },
        ],
      ],
      exits: [[{ code: 0 }]],
    });
    expect(vi.mocked(run.history.commitsAfter).mock.calls).toEqual([
      [{ repoRoot: "/repo", revision: "v0.1.0-pre.7" }],
      [{ repoRoot: "/repo", revision: "v0.1.0-pre.5" }],
    ]);
  });

  it("starts 1.0.0's pre-release line when no channel is asked for, staying on the latest tag's channel", () => {
    expect(runFromPre7({ arguments: [] }).texts["/repo/package.json"]).toBe(
      manifestAt({ version: "1.0.0-pre.1" }),
    );
  });
});

describe("runReleasePullRequest finishing a pre-release line with sections in the changelog", () => {
  it("folds the line's pre-release sections into the stable section, leaves no pre-release heading, and counts the folded entries", () => {
    const run = runWith({
      arguments: ["stable"],
      files: {
        "/repo/CHANGELOG.md":
          "# Changelog\n\n## 2.0.0-pre.2\n\n### Fixes\n\n- second (#2)\n\n## 2.0.0-pre.1\n\n### Breaking changes\n\n- first (#1)\n\n## 1.0.0\n\nOld.\n",
        "/repo/package.json": manifestAt({ version: "2.0.0-pre.2" }),
      },
      tags: { outcome: "ok", value: ["v1.0.0", "v2.0.0-pre.1", "v2.0.0-pre.2"] },
      commits: { outcome: "ok", value: [squashed("fix: third (#3)")] },
      lineCommits: {
        outcome: "ok",
        value: [
          squashed("feat!: first (#1)"),
          squashed("fix: second (#2)"),
          squashed("fix: third (#3)"),
        ],
      },
    });

    expect(run.texts["/repo/CHANGELOG.md"]).toBe(
      "# Changelog\n\n## 2.0.0\n\n### Breaking changes\n\n- first (#1)\n\n### Fixes\n\n- second (#2)\n- third (#3)\n\n## 1.0.0\n\nOld.\n",
    );
    expect(run.texts["/repo/package.json"]).toBe(manifestAt({ version: "2.0.0" }));
    expect(run.writes).toEqual([
      [
        {
          text: "release-pull-request: 2.0.0-pre.2 to 2.0.0, a major change on the stable channel, sized from 3 subjects since v1.0.0, with 1 subject since v2.0.0-pre.2 and 2 entries folded from its pre-releases in its section. CHANGELOG.md and package.json are updated in the working tree; no tag was made and nothing was published.\n",
        },
      ],
    ]);
  });
});

describe("runReleasePullRequest from the stable 1.0.0", () => {
  const runFrom100 = (request: {
    readonly arguments?: readonly string[];
    readonly commits: readonly CommitRecord[];
  }) =>
    runWith({
      arguments: request.arguments,
      files: filesAt({ version: "1.0.0" }),
      tags: { outcome: "ok", value: ["v0.1.0-pre.7", "v1.0.0"] },
      commits: { outcome: "ok", value: request.commits },
    });

  it.each([
    { commits: [squashed("fix: one (#1)"), squashed("docs: two (#2)")], next: "1.0.1" },
    { commits: [squashed("fix: one (#1)"), squashed("feat: two (#2)")], next: "1.1.0" },
    { commits: [squashed("feat: one (#1)"), squashed("fix!: two (#2)")], next: "2.0.0" },
    { commits: [squashed("fix: one (#1)\n\nBREAKING CHANGE: renamed a key")], next: "2.0.0" },
  ])("releases $next on the stable channel by default", ({ commits, next }) => {
    expect(runFrom100({ commits }).texts["/repo/package.json"]).toBe(manifestAt({ version: next }));
  });

  it.each([
    { commits: [squashed("fix: one (#1)")], next: "1.0.1-pre.1" },
    { commits: [squashed("feat: one (#1)")], next: "1.1.0-pre.1" },
    { commits: [squashed("feat!: one (#1)")], next: "2.0.0-pre.1" },
  ])("starts a pre-release line at $next when asked", ({ commits, next }) => {
    expect(runFrom100({ arguments: ["pre-release"], commits }).texts["/repo/package.json"]).toBe(
      manifestAt({ version: next }),
    );
  });
});

describe("runReleasePullRequest on a pre-release line after 1.0.0", () => {
  const runOn110Pre1 = (request: {
    readonly arguments?: readonly string[];
    readonly latest: CommitRecord;
  }) =>
    runWith({
      arguments: request.arguments,
      files: filesAt({ version: "1.1.0-pre.1" }),
      tags: { outcome: "ok", value: ["v1.0.0", "v1.1.0-pre.1"] },
      commits: { outcome: "ok", value: [request.latest] },
      lineCommits: { outcome: "ok", value: [squashed("feat: one (#1)"), request.latest] },
    });

  it("moves to the next pre-release number while the line's changes since 1.0.0 fit the minor it is numbered towards", () => {
    expect(runOn110Pre1({ latest: squashed("fix: two (#2)") }).texts["/repo/package.json"]).toBe(
      manifestAt({ version: "1.1.0-pre.2" }),
    );
  });

  it("finishes the line as 1.1.0 when asked for the stable release", () => {
    expect(
      runOn110Pre1({ arguments: ["stable"], latest: squashed("fix: two (#2)") }).texts[
        "/repo/package.json"
      ],
    ).toBe(manifestAt({ version: "1.1.0" }));
  });

  it("starts 2.0.0's line when a breaking change lands", () => {
    expect(runOn110Pre1({ latest: squashed("fix!: two (#2)") }).texts["/repo/package.json"]).toBe(
      manifestAt({ version: "2.0.0-pre.1" }),
    );
  });
});

describe("runReleasePullRequest refusing on the repository's state", () => {
  it("refuses to prepare a release with no subjects since the tag", () => {
    const run = runWith({ commits: { outcome: "ok", value: [] } });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      writes: [],
      errors: [
        [
          {
            text: "release-pull-request: nothing is merged since v0.1.0-pre.3, so there is nothing to release.\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when package.json is not at the latest release's version", () => {
    const run = runWith({
      files: {
        "/repo/CHANGELOG.md": CHANGELOG,
        "/repo/package.json": '{ "version": "0.1.0-pre.4" }\n',
      },
    });

    expect(run).toMatchObject({
      texts: {
        "/repo/CHANGELOG.md": CHANGELOG,
        "/repo/package.json": '{ "version": "0.1.0-pre.4" }\n',
      },
      writes: [],
      errors: [
        [
          {
            text: "release-pull-request: package.json is at 0.1.0-pre.4, not v0.1.0-pre.3's 0.1.0-pre.3, so a release is already prepared or the tag is missing.\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when the changelog already has the next version", () => {
    const run = runWith({
      files: {
        "/repo/CHANGELOG.md": `${CHANGELOG}\n## 0.1.0-pre.4\n`,
        "/repo/package.json": MANIFEST,
      },
    });

    expect(run).toMatchObject({
      writes: [],
      errors: [
        [{ text: "release-pull-request: CHANGELOG.md already has a section for 0.1.0-pre.4\n" }],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when no release tag is merged", () => {
    const run = runWith({ tags: { outcome: "ok", value: ["backup-pre1-before-rewrite"] } });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      errors: [[{ text: "release-pull-request: no release tag v<version> is merged into HEAD\n" }]],
      exits: [[{ code: 1 }]],
    });
  });
});

describe("runReleasePullRequest refusing a history that is not linear", () => {
  it("refuses, naming each merge commit, when the history since the tag is not linear", () => {
    const run = runWith({
      commits: {
        outcome: "ok",
        value: [
          { parentCount: 1, message: "fix: one (#41)" },
          { parentCount: 2, message: "Merge remote-tracking branch 'origin/main' into a-branch" },
        ],
      },
    });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      writes: [],
      errors: [
        [
          {
            text: "release-pull-request: the commits since v0.1.0-pre.3 include a merge commit, \"Merge remote-tracking branch 'origin/main' into a-branch\", and a merge's other parent brings in changes this script cannot size from one line of subjects. Run it on a new branch at the tip of main, before anything is committed to it; if main itself holds a merge since the tag, prepare this release by hand.\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });
});

describe("runReleasePullRequest refusing on failures and usage", () => {
  it("refuses when git fails", () => {
    const run = runWith({
      commits: {
        outcome: "failed",
        error: { kind: "git-failed", command: "git log", detail: "fatal: bad revision" },
      },
    });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      errors: [[{ text: "release-pull-request: git log failed: fatal: bad revision\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when package.json has no version it can read", () => {
    const run = runWith({
      files: { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": '{ "private": true }\n' },
    });

    expect(run).toMatchObject({
      errors: [
        [
          {
            text: expect.stringMatching(
              /^release-pull-request: package\.json has no readable version: .*version/s,
            ),
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("restores every file it wrote when a later write fails", () => {
    const run = runWith({ unwritablePaths: ["/repo/package.json"] });

    expect(run).toMatchObject({
      texts: UNCHANGED,
      writes: [],
      errors: [
        [
          {
            text: "release-pull-request: cannot write /repo/package.json: EACCES; the files it had written are restored\n",
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses a package.json that holds the version field more than once", () => {
    const manifest =
      '{\n  "version": "0.1.0-pre.3",\n  "config": { "version": "0.1.0-pre.3" }\n}\n';
    const run = runWith({
      files: { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": manifest },
    });

    expect(run).toMatchObject({
      texts: { "/repo/CHANGELOG.md": CHANGELOG, "/repo/package.json": manifest },
      errors: [
        [
          {
            text: 'release-pull-request: package.json does not hold "version": "0.1.0-pre.3" exactly once\n',
          },
        ],
      ],
      exits: [[{ code: 1 }]],
    });
  });

  it("refuses when a file cannot be read", () => {
    const run = runWith({ files: { "/repo/package.json": MANIFEST } });

    expect(run).toMatchObject({
      errors: [[{ text: "release-pull-request: cannot read /repo/CHANGELOG.md: ENOENT\n" }]],
      exits: [[{ code: 1 }]],
    });
  });

  it.each([[["beta"]], [["stable", "stable"]]])(
    "exits 2 with its usage for the arguments %j",
    (releaseArguments) => {
      const run = runWith({ arguments: releaseArguments });

      expect(run).toMatchObject({
        texts: UNCHANGED,
        errors: [[{ text: "usage: release-pull-request [pre-release|stable]\n" }]],
        exits: [[{ code: 2 }]],
      });
    },
  );
});
