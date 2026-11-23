import { describe, expect, it } from "vitest";

import { changeEntryOf } from "../commit-subject/conventional-subject.ts";
import {
  changelogSectionOf,
  changelogWithFoldedSection,
  changelogWithSection,
} from "./changelog.ts";

describe("changelogSectionOf", () => {
  it("groups the changes under fixed headings in a fixed order, keeping their order within each", () => {
    expect(
      changelogSectionOf({
        version: "0.2.0",
        entries: [
          changeEntryOf({ message: "chore: tidy the scripts (#30)" }),
          changeEntryOf({ message: "fix(audit): read CRLF files (#31)" }),
          changeEntryOf({ message: "feat(eslint)!: rename the plugin namespace (#32)" }),
          changeEntryOf({ message: "feat: add a report output (#33)" }),
          changeEntryOf({ message: "perf: cache the projection (#34)" }),
          changeEntryOf({ message: "Keep versions out of the docs (#20)" }),
        ],
      }),
    ).toBe(
      "## 0.2.0\n\n### Breaking changes\n\n- eslint: rename the plugin namespace (#32)\n\n### Features\n\n- add a report output (#33)\n\n### Fixes\n\n- audit: read CRLF files (#31)\n- cache the projection (#34)\n\n### Other changes\n\n- tidy the scripts (#30)\n- Keep versions out of the docs (#20)\n",
    );
  });

  it("lists a subject that is not conventional but carries a breaking footer under breaking changes", () => {
    expect(
      changelogSectionOf({
        version: "2.0.0",
        entries: [
          changeEntryOf({ message: "Merge pull request #7\n\nBREAKING CHANGE: renamed a key" }),
        ],
      }),
    ).toBe("## 2.0.0\n\n### Breaking changes\n\n- Merge pull request #7\n");
  });

  it("leaves out headings with no changes", () => {
    expect(
      changelogSectionOf({ version: "1.0.1", entries: [changeEntryOf({ message: "fix: one" })] }),
    ).toBe("## 1.0.1\n\n### Fixes\n\n- one\n");
  });
});

describe("changelogWithSection", () => {
  const INTRO = "# Changelog\n\nIntro.\n";

  it("puts the new section above the newest one", () => {
    expect(
      changelogWithSection({
        changelog: `${INTRO}\n## 0.1.0\n\nOld.\n`,
        version: "0.1.1",
        section: "## 0.1.1\n\nNew.\n",
      }),
    ).toEqual({
      outcome: "ok",
      value: `${INTRO}\n## 0.1.1\n\nNew.\n\n## 0.1.0\n\nOld.\n`,
    });
  });

  it("appends the section to a changelog with no sections yet", () => {
    expect(
      changelogWithSection({ changelog: INTRO, version: "0.1.0", section: "## 0.1.0\n\nNew.\n" }),
    ).toEqual({
      outcome: "ok",
      value: `${INTRO}\n## 0.1.0\n\nNew.\n`,
    });
  });

  it("refuses a version the changelog already has", () => {
    expect(
      changelogWithSection({
        changelog: `${INTRO}\n## 0.1.1\n\nOld.\n`,
        version: "0.1.1",
        section: "## 0.1.1\n",
      }),
    ).toEqual({
      outcome: "failed",
      error: "CHANGELOG.md already has a section for 0.1.1",
    });
  });
});

describe("changelogWithFoldedSection", () => {
  const INTRO = "# Changelog\n\nIntro.\n";

  const PRE_RELEASES =
    "## 2.0.0-pre.2\n\n### Fixes\n\n- carry a carve-out (#352)\n- point imports (#353)\n\n### Other changes\n\n- trim pages (#347)\n\n## 2.0.0-pre.1\n\n### Breaking changes\n\n- move into layers (#318)\n\n### Features\n\n- one address (#206)\n\n### Fixes\n\n- an older fix (#300)\n";

  it("folds every pre-release section of the version into its one section, in the fixed group order, oldest first within a group", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.3\n\n### Fixes\n\n- index once (#365)\n\n${PRE_RELEASES}\n## 1.0.0\n\nOld.\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [changeEntryOf({ message: "fix: last fix (#370)" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 2.0.0\n\n### Breaking changes\n\n- move into layers (#318)\n\n### Features\n\n- one address (#206)\n\n### Fixes\n\n- an older fix (#300)\n- carry a carve-out (#352)\n- point imports (#353)\n- index once (#365)\n- last fix (#370)\n\n### Other changes\n\n- trim pages (#347)\n\n## 1.0.0\n\nOld.\n`,
        folded: 7,
      },
    });
  });

  it("lists a pull request once, by its number, when a pre-release section and the new entries both hold it", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.1\n\n### Fixes\n\n- one (#1)\n- three (#3)\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [
          changeEntryOf({ message: "fix: one, reworded (#1)" }),
          changeEntryOf({ message: "fix: two (#2)" }),
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 2.0.0\n\n### Fixes\n\n- three (#3)\n- one, reworded (#1)\n- two (#2)\n`,
        folded: 1,
      },
    });
  });

  it("lists a pull request once when two pre-release sections both hold it", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.2\n\n### Fixes\n\n- one again (#1)\n\n## 2.0.0-pre.1\n\n### Fixes\n\n- one (#1)\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [changeEntryOf({ message: "fix: two (#2)" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 2.0.0\n\n### Fixes\n\n- one again (#1)\n- two (#2)\n`,
        folded: 1,
      },
    });
  });

  it("keeps every new entry, repeated subjects included", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 1.0.0\n\nOld.\n`,
        version: "1.0.1",
        channel: "stable",
        entries: [
          changeEntryOf({ message: "chore: same" }),
          changeEntryOf({ message: "chore: same" }),
        ],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 1.0.1\n\n### Other changes\n\n- same\n- same\n\n## 1.0.0\n\nOld.\n`,
        folded: 0,
      },
    });
  });

  it("folds the pre-release sections of every version the line passed through", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 1.1.0-pre.1\n\n### Features\n\n- add (#2)\n\n## 1.0.1-pre.1\n\n### Fixes\n\n- mend (#1)\n\n## 1.0.0\n\nOld.\n`,
        version: "1.1.0",
        channel: "stable",
        entries: [changeEntryOf({ message: "fix: last (#3)" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 1.1.0\n\n### Features\n\n- add (#2)\n\n### Fixes\n\n- mend (#1)\n- last (#3)\n\n## 1.0.0\n\nOld.\n`,
        folded: 2,
      },
    });
  });

  it("leaves the pre-release sections below the newest stable section alone", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 1.0.0\n\nOld.\n\n## 0.1.0-pre.1\n\n### Fixes\n\n- kept (#1)\n`,
        version: "1.0.1",
        channel: "stable",
        entries: [changeEntryOf({ message: "fix: new (#2)" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 1.0.1\n\n### Fixes\n\n- new (#2)\n\n## 1.0.0\n\nOld.\n\n## 0.1.0-pre.1\n\n### Fixes\n\n- kept (#1)\n`,
        folded: 0,
      },
    });
  });

  it("keeps every folded entry that names no pull request, repeated ones included", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.2\n\n### Other changes\n\n- same\n\n## 2.0.0-pre.1\n\n### Other changes\n\n- same\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [changeEntryOf({ message: "chore: same" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 2.0.0\n\n### Other changes\n\n- same\n- same\n- same\n`,
        folded: 2,
      },
    });
  });

  it("folds nothing into a pre-release", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.1\n\n### Fixes\n\n- one (#1)\n`,
        version: "2.0.0-pre.2",
        channel: "pre-release",
        entries: [changeEntryOf({ message: "fix: two (#2)" })],
      }),
    ).toEqual({
      outcome: "ok",
      value: {
        text: `${INTRO}\n## 2.0.0-pre.2\n\n### Fixes\n\n- two (#2)\n\n## 2.0.0-pre.1\n\n### Fixes\n\n- one (#1)\n`,
        folded: 0,
      },
    });
  });

  it("refuses a version the changelog already has", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0\n\nOld.\n\n## 2.0.0-pre.1\n\n### Fixes\n\n- one (#1)\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [],
      }),
    ).toEqual({ outcome: "failed", error: "CHANGELOG.md already has a section for 2.0.0" });
  });

  it("refuses a pre-release section with a group it cannot place", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.1\n\n### Notes\n\n- one (#1)\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: "## 2.0.0-pre.1 has a group, Notes, that cannot be folded",
    });
  });

  it("refuses a pre-release section with a line that is neither a group nor an entry", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.1\n\nProse.\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: '## 2.0.0-pre.1 has a line, "Prose.", that cannot be folded',
    });
  });

  it("refuses a pre-release section with an entry before any group heading", () => {
    expect(
      changelogWithFoldedSection({
        changelog: `${INTRO}\n## 2.0.0-pre.1\n\n- one (#1)\n`,
        version: "2.0.0",
        channel: "stable",
        entries: [],
      }),
    ).toEqual({
      outcome: "failed",
      error: '## 2.0.0-pre.1 has a line, "- one (#1)", that cannot be folded',
    });
  });
});
