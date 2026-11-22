import { describe, expect, it } from "vitest";

import { changeEntryOf } from "../commit-subject/conventional-subject.ts";
import {
  channelOf,
  nextVersionOf,
  releaseLineOf,
  type ReleaseChannel,
  type ReleaseSize,
  releaseSizeOf,
  type Version,
  versionOf,
  versionText,
} from "./release-version.ts";

type VersionCore = { readonly major: number; readonly minor: number; readonly patch: number };

const stable = (request: VersionCore): Version => ({ ...request, preRelease: undefined });

const pre = (request: VersionCore & { readonly number: number }): Version => ({
  major: request.major,
  minor: request.minor,
  patch: request.patch,
  preRelease: { identifier: "pre", number: request.number },
});

describe("versionOf", () => {
  it("reads a stable version", () => {
    expect(versionOf({ text: "1.2.3" })).toEqual({
      outcome: "ok",
      value: stable({ major: 1, minor: 2, patch: 3 }),
    });
  });

  it("reads a numbered pre-release", () => {
    expect(versionOf({ text: "0.1.0-pre.3" })).toEqual({
      outcome: "ok",
      value: pre({ major: 0, minor: 1, patch: 0, number: 3 }),
    });
  });

  it.each([
    "1.2",
    "v1.2.3",
    "01.2.3",
    "1.2.3-pre",
    "1.2.3-pre.01",
    "1.2.3+build.1",
    "1.2.3-pre.1.2",
  ])("refuses %s", (text) => {
    expect(versionOf({ text })).toEqual({
      outcome: "failed",
      error: `${text} is not a version this script prepares: major.minor.patch, optionally followed by -<identifier>.<number>`,
    });
  });
});

describe("versionText", () => {
  it.each([
    { version: stable({ major: 1, minor: 2, patch: 3 }), text: "1.2.3" },
    { version: pre({ major: 0, minor: 1, patch: 0, number: 3 }), text: "0.1.0-pre.3" },
  ])("writes $text", ({ version, text }) => {
    expect(versionText({ version })).toBe(text);
  });
});

describe("channelOf", () => {
  it.each([
    { version: pre({ major: 0, minor: 1, patch: 0, number: 3 }), channel: "pre-release" },
    { version: stable({ major: 1, minor: 2, patch: 3 }), channel: "stable" },
  ] satisfies ReadonlyArray<{ readonly version: Version; readonly channel: ReleaseChannel }>)(
    "puts a version on the $channel channel",
    ({ version, channel }) => {
      expect(channelOf({ version })).toBe(channel);
    },
  );
});

describe("releaseLineOf", () => {
  it("picks the highest release tag as the latest, ranking a stable release above its pre-releases", () => {
    expect(
      releaseLineOf({
        tags: [
          "v0.1.0-pre.1",
          "v0.1.0",
          "v0.1.0-pre.3",
          "v0.1.0-pre.2",
          "backup-pre1-before-rewrite",
        ],
      }),
    ).toMatchObject({
      outcome: "ok",
      value: { latest: { tag: "v0.1.0", version: stable({ major: 0, minor: 1, patch: 0 }) } },
    });
  });

  it("ranks pre-releases by number, not as text", () => {
    expect(releaseLineOf({ tags: ["v0.1.0-pre.9", "v0.1.0-pre.10", "v0.0.9"] })).toMatchObject({
      outcome: "ok",
      value: {
        latest: {
          tag: "v0.1.0-pre.10",
          version: pre({ major: 0, minor: 1, patch: 0, number: 10 }),
        },
      },
    });
  });

  it("ranks pre-release identifiers in ASCII order, as semver does, so an uppercase identifier ranks below a lowercase one", () => {
    expect(releaseLineOf({ tags: ["v1.0.0-alpha.1", "v1.0.0-Beta.1"] })).toMatchObject({
      outcome: "ok",
      value: {
        latest: {
          tag: "v1.0.0-alpha.1",
          version: { major: 1, minor: 0, patch: 0, preRelease: { identifier: "alpha", number: 1 } },
        },
      },
    });
  });

  it("ranks an identifier above its own prefix, whatever the numbers", () => {
    expect(releaseLineOf({ tags: ["v1.0.0-pre-a.1", "v1.0.0-pre.2"] })).toMatchObject({
      outcome: "ok",
      value: {
        latest: {
          tag: "v1.0.0-pre-a.1",
          version: { major: 1, minor: 0, patch: 0, preRelease: { identifier: "pre-a", number: 1 } },
        },
      },
    });
  });

  it("sizes a line from the latest stable release, which is the latest release itself when that is stable", () => {
    expect([
      releaseLineOf({ tags: ["v1.0.0", "v1.1.0-pre.1", "v0.1.0-pre.7", "v1.1.0-pre.2"] }),
      releaseLineOf({ tags: ["v1.0.0", "v1.0.1"] }),
    ]).toEqual([
      {
        outcome: "ok",
        value: {
          latest: {
            tag: "v1.1.0-pre.2",
            version: pre({ major: 1, minor: 1, patch: 0, number: 2 }),
          },
          start: { tag: "v1.0.0", version: stable({ major: 1, minor: 0, patch: 0 }) },
        },
      },
      {
        outcome: "ok",
        value: {
          latest: { tag: "v1.0.1", version: stable({ major: 1, minor: 0, patch: 1 }) },
          start: { tag: "v1.0.1", version: stable({ major: 1, minor: 0, patch: 1 }) },
        },
      },
    ]);
  });

  it("sizes a line from the earliest release when no release is stable", () => {
    expect(releaseLineOf({ tags: ["v0.1.0-pre.6", "v0.1.0-pre.5", "v0.1.0-pre.7"] })).toEqual({
      outcome: "ok",
      value: {
        latest: { tag: "v0.1.0-pre.7", version: pre({ major: 0, minor: 1, patch: 0, number: 7 }) },
        start: { tag: "v0.1.0-pre.5", version: pre({ major: 0, minor: 1, patch: 0, number: 5 }) },
      },
    });
  });

  it("fails when no tag is a release tag", () => {
    expect(releaseLineOf({ tags: ["backup-pre1-before-rewrite", "vnext"] })).toEqual({
      outcome: "failed",
      error: "no release tag v<version> is merged into HEAD",
    });
  });
});

describe("releaseSizeOf", () => {
  it("is a major for any breaking subject", () => {
    expect(
      releaseSizeOf({
        entries: [
          changeEntryOf({ message: "fix: one" }),
          changeEntryOf({ message: "docs!: rename an address" }),
          changeEntryOf({ message: "feat: two" }),
        ],
      }),
    ).toBe("major");
  });

  it("is a minor for a feature without a breaking subject", () => {
    expect(
      releaseSizeOf({
        entries: [changeEntryOf({ message: "fix: one" }), changeEntryOf({ message: "feat: two" })],
      }),
    ).toBe("minor");
  });

  it("is a patch for any other conventional or unclassified subject", () => {
    expect(
      releaseSizeOf({
        entries: [
          changeEntryOf({ message: "chore: one" }),
          changeEntryOf({ message: "Keep versions out of the docs (#20)" }),
        ],
      }),
    ).toBe("patch");
  });

  it("is a major for a breaking footer, even under a subject that is not conventional", () => {
    expect(
      releaseSizeOf({
        entries: [
          changeEntryOf({ message: "Merge pull request #7\n\nBREAKING-CHANGE: renamed a key" }),
        ],
      }),
    ).toBe("major");
  });

  it("is a patch for a revert and a major for a revert marked breaking", () => {
    expect([
      releaseSizeOf({ entries: [changeEntryOf({ message: "revert: undo an unreleased change" })] }),
      releaseSizeOf({ entries: [changeEntryOf({ message: "revert!: withdraw a released flag" })] }),
    ]).toEqual(["patch", "major"]);
  });

  it("is nothing for no subjects", () => {
    expect(releaseSizeOf({ entries: [] })).toBe("nothing");
  });
});

describe("nextVersionOf", () => {
  it.each([
    {
      current: pre({ major: 0, minor: 1, patch: 0, number: 3 }),
      size: "patch",
      channel: "pre-release",
      next: pre({ major: 0, minor: 1, patch: 0, number: 4 }),
    },
    {
      current: pre({ major: 0, minor: 1, patch: 0, number: 3 }),
      size: "minor",
      channel: "pre-release",
      next: pre({ major: 0, minor: 1, patch: 0, number: 4 }),
    },
    {
      current: pre({ major: 0, minor: 1, patch: 0, number: 3 }),
      size: "major",
      channel: "pre-release",
      next: pre({ major: 1, minor: 0, patch: 0, number: 1 }),
    },
    {
      current: pre({ major: 0, minor: 1, patch: 0, number: 3 }),
      size: "patch",
      channel: "stable",
      next: stable({ major: 0, minor: 1, patch: 0 }),
    },
    {
      current: pre({ major: 0, minor: 1, patch: 1, number: 2 }),
      size: "minor",
      channel: "pre-release",
      next: pre({ major: 0, minor: 2, patch: 0, number: 1 }),
    },
    {
      current: pre({ major: 1, minor: 0, patch: 0, number: 2 }),
      size: "major",
      channel: "pre-release",
      next: pre({ major: 1, minor: 0, patch: 0, number: 3 }),
    },
    {
      current: pre({ major: 1, minor: 1, patch: 0, number: 2 }),
      size: "major",
      channel: "stable",
      next: stable({ major: 2, minor: 0, patch: 0 }),
    },
    {
      current: pre({ major: 1, minor: 1, patch: 0, number: 2 }),
      size: "minor",
      channel: "stable",
      next: stable({ major: 1, minor: 1, patch: 0 }),
    },
    {
      current: stable({ major: 1, minor: 2, patch: 3 }),
      size: "patch",
      channel: "stable",
      next: stable({ major: 1, minor: 2, patch: 4 }),
    },
    {
      current: stable({ major: 1, minor: 2, patch: 3 }),
      size: "minor",
      channel: "stable",
      next: stable({ major: 1, minor: 3, patch: 0 }),
    },
    {
      current: stable({ major: 1, minor: 2, patch: 3 }),
      size: "major",
      channel: "stable",
      next: stable({ major: 2, minor: 0, patch: 0 }),
    },
    {
      current: stable({ major: 1, minor: 2, patch: 3 }),
      size: "major",
      channel: "pre-release",
      next: pre({ major: 2, minor: 0, patch: 0, number: 1 }),
    },
    {
      current: stable({ major: 0, minor: 3, patch: 4 }),
      size: "major",
      channel: "stable",
      next: stable({ major: 1, minor: 0, patch: 0 }),
    },
    {
      current: stable({ major: 0, minor: 3, patch: 4 }),
      size: "minor",
      channel: "stable",
      next: stable({ major: 0, minor: 4, patch: 0 }),
    },
    {
      current: stable({ major: 0, minor: 3, patch: 4 }),
      size: "patch",
      channel: "stable",
      next: stable({ major: 0, minor: 3, patch: 5 }),
    },
    {
      current: pre({ major: 0, minor: 1, patch: 0, number: 7 }),
      size: "major",
      channel: "stable",
      next: stable({ major: 1, minor: 0, patch: 0 }),
    },
    {
      current: pre({ major: 0, minor: 1, patch: 0, number: 7 }),
      size: "major",
      channel: "pre-release",
      next: pre({ major: 1, minor: 0, patch: 0, number: 1 }),
    },
  ] satisfies ReadonlyArray<{
    readonly current: Version;
    readonly size: ReleaseSize;
    readonly channel: ReleaseChannel;
    readonly next: Version;
  }>)("case $#: a $size change on the $channel channel", ({ current, size, channel, next }) => {
    expect(nextVersionOf({ current, size, channel })).toEqual(next);
  });

  it.each([
    {
      current: stable({ major: 1, minor: 0, patch: 0 }),
      size: "patch",
      channel: "pre-release",
      next: "1.0.1-pre.1",
    },
    {
      current: pre({ major: 1, minor: 0, patch: 1, number: 1 }),
      size: "patch",
      channel: "pre-release",
      next: "1.0.1-pre.2",
    },
    {
      current: pre({ major: 1, minor: 0, patch: 1, number: 2 }),
      size: "minor",
      channel: "pre-release",
      next: "1.1.0-pre.1",
    },
    {
      current: pre({ major: 1, minor: 1, patch: 0, number: 1 }),
      size: "minor",
      channel: "pre-release",
      next: "1.1.0-pre.2",
    },
    {
      current: pre({ major: 1, minor: 1, patch: 0, number: 2 }),
      size: "minor",
      channel: "stable",
      next: "1.1.0",
    },
  ] satisfies ReadonlyArray<{
    readonly current: Version;
    readonly size: ReleaseSize;
    readonly channel: ReleaseChannel;
    readonly next: string;
  }>)(
    "walks a pre-release line from 1.0.0 to $next for a $size line on the $channel channel",
    ({ current, size, channel, next }) => {
      expect(versionText({ version: nextVersionOf({ current, size, channel }) })).toBe(next);
    },
  );
});
