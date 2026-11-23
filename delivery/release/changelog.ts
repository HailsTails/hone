import type { Result } from "../../src/domain/result.ts";
import type { ChangeEntry, ChangeType } from "../commit-subject/conventional-subject.ts";

export const CHANGELOG_FILE = "CHANGELOG.md";

export type ChangeGroup = "Breaking changes" | "Features" | "Fixes" | "Other changes";

const GROUPS_IN_ORDER: readonly ChangeGroup[] = [
  "Breaking changes",
  "Features",
  "Fixes",
  "Other changes",
];

const GROUP_OF_TYPE: Readonly<Record<ChangeType, ChangeGroup>> = {
  feat: "Features",
  fix: "Fixes",
  perf: "Fixes",
  revert: "Fixes",
  docs: "Other changes",
  refactor: "Other changes",
  test: "Other changes",
  build: "Other changes",
  ci: "Other changes",
  chore: "Other changes",
  style: "Other changes",
};

const SECTION_HEADING_PREFIX = "## ";

export const changelogGroupOf = (request: { readonly entry: ChangeEntry }): ChangeGroup => {
  if (request.entry.kind === "unclassified") {
    return request.entry.compatibility === "breaking" ? "Breaking changes" : "Other changes";
  }
  return request.entry.subject.compatibility === "breaking"
    ? "Breaking changes"
    : GROUP_OF_TYPE[request.entry.subject.type];
};

type ChangeLine = { readonly group: ChangeGroup; readonly line: string };

const GROUP_HEADING_PREFIX = "### ";

const BULLET_PREFIX = "- ";

const lineOf = (request: { readonly entry: ChangeEntry }): string => {
  if (request.entry.kind === "unclassified") {
    return `${BULLET_PREFIX}${request.entry.subject}`;
  }
  const scope = request.entry.subject.scope === undefined ? "" : `${request.entry.subject.scope}: `;
  return `${BULLET_PREFIX}${scope}${request.entry.subject.description}`;
};

const changeLineOf = (request: { readonly entry: ChangeEntry }): ChangeLine => ({
  group: changelogGroupOf(request),
  line: lineOf(request),
});

const groupBlock = (request: {
  readonly group: ChangeGroup;
  readonly lines: readonly ChangeLine[];
}): readonly string[] => {
  const own = request.lines.filter((line) => line.group === request.group);
  return own.length === 0
    ? []
    : [`${GROUP_HEADING_PREFIX}${request.group}`, "", ...own.map((line) => line.line), ""];
};

const headingOf = (request: { readonly version: string }): string =>
  `${SECTION_HEADING_PREFIX}${request.version}`;

const sectionOfLines = (request: {
  readonly version: string;
  readonly lines: readonly ChangeLine[];
}): string =>
  [
    headingOf(request),
    "",
    ...GROUPS_IN_ORDER.flatMap((group) => groupBlock({ group, lines: request.lines })),
  ].join("\n");

export const changelogSectionOf = (request: {
  readonly version: string;
  readonly entries: readonly ChangeEntry[];
}): string =>
  sectionOfLines({
    version: request.version,
    lines: request.entries.map((entry) => changeLineOf({ entry })),
  });

export const changelogWithSection = (request: {
  readonly changelog: string;
  readonly version: string;
  readonly section: string;
}): Result<string, string> => {
  const lines = request.changelog.split("\n");
  if (lines.includes(headingOf(request))) {
    return {
      outcome: "failed",
      error: `${CHANGELOG_FILE} already has a section for ${request.version}`,
    };
  }
  const newest = lines.findIndex((line) => line.startsWith(SECTION_HEADING_PREFIX));
  if (newest === -1) {
    return { outcome: "ok", value: `${request.changelog}\n${request.section}` };
  }
  return {
    outcome: "ok",
    value: [...lines.slice(0, newest), ...request.section.split("\n"), ...lines.slice(newest)].join(
      "\n",
    ),
  };
};

type SectionBounds = { readonly start: number; readonly end: number };

const sectionBoundsOf = (request: {
  readonly lines: readonly string[];
}): readonly SectionBounds[] => {
  const starts = request.lines.flatMap((line, index) =>
    line.startsWith(SECTION_HEADING_PREFIX) ? [index] : [],
  );
  return starts.map((start, position) => ({
    start,
    end: starts[position + 1] ?? request.lines.length,
  }));
};

type FoldingState = {
  readonly group: ChangeGroup | undefined;
  readonly found: readonly ChangeLine[];
};

const foldedLineOf = (request: {
  readonly heading: string;
  readonly state: FoldingState;
  readonly line: string;
}): Result<FoldingState, string> => {
  if (request.line.startsWith(GROUP_HEADING_PREFIX)) {
    const name = request.line.slice(GROUP_HEADING_PREFIX.length);
    const group = GROUPS_IN_ORDER.find((candidate) => candidate === name);
    return group === undefined
      ? {
          outcome: "failed",
          error: `${request.heading} has a group, ${name}, that cannot be folded`,
        }
      : { outcome: "ok", value: { group, found: request.state.found } };
  }
  if (request.line.startsWith(BULLET_PREFIX) && request.state.group !== undefined) {
    return {
      outcome: "ok",
      value: {
        group: request.state.group,
        found: [...request.state.found, { group: request.state.group, line: request.line }],
      },
    };
  }
  return request.line.trim() === ""
    ? { outcome: "ok", value: request.state }
    : {
        outcome: "failed",
        error: `${request.heading} has a line, ${JSON.stringify(request.line)}, that cannot be folded`,
      };
};

const changeLinesOfSection = (request: {
  readonly lines: readonly string[];
  readonly bounds: SectionBounds;
}): Result<readonly ChangeLine[], string> => {
  const heading = request.lines[request.bounds.start] ?? "";
  const folded = request.lines
    .slice(request.bounds.start + 1, request.bounds.end)
    .reduce<Result<FoldingState, string>>(
      (soFar, line) =>
        soFar.outcome === "failed" ? soFar : foldedLineOf({ heading, state: soFar.value, line }),
      { outcome: "ok", value: { group: undefined, found: [] } },
    );
  return folded.outcome === "failed" ? folded : { outcome: "ok", value: folded.value.found };
};

const withoutRepeats = (request: {
  readonly lines: readonly ChangeLine[];
}): readonly ChangeLine[] =>
  request.lines.filter(
    (candidate, index) =>
      request.lines.findIndex((other) => other.line === candidate.line) === index,
  );

export const changelogWithFoldedSection = (request: {
  readonly changelog: string;
  readonly version: string;
  readonly entries: readonly ChangeEntry[];
}): Result<string, string> => {
  const lines = request.changelog.split("\n");
  const preReleasePrefix = `${headingOf(request)}-`;
  const folded = sectionBoundsOf({ lines })
    .filter((bounds) => lines[bounds.start]?.startsWith(preReleasePrefix) === true)
    .toReversed();
  const carried = folded.reduce<Result<readonly ChangeLine[], string>>(
    (soFar, bounds) => {
      if (soFar.outcome === "failed") {
        return soFar;
      }
      const section = changeLinesOfSection({ lines, bounds });
      return section.outcome === "failed"
        ? section
        : { outcome: "ok", value: [...soFar.value, ...section.value] };
    },
    { outcome: "ok", value: [] },
  );
  if (carried.outcome === "failed") {
    return carried;
  }
  return changelogWithSection({
    changelog: lines
      .filter(
        (_line, index) => !folded.some((bounds) => index >= bounds.start && index < bounds.end),
      )
      .join("\n"),
    version: request.version,
    section: sectionOfLines({
      version: request.version,
      lines: withoutRepeats({
        lines: [...carried.value, ...request.entries.map((entry) => changeLineOf({ entry }))],
      }),
    }),
  });
};
