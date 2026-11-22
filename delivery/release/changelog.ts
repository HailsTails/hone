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

const lineOf = (request: { readonly entry: ChangeEntry }): string => {
  if (request.entry.kind === "unclassified") {
    return `- ${request.entry.subject}`;
  }
  const scope = request.entry.subject.scope === undefined ? "" : `${request.entry.subject.scope}: `;
  return `- ${scope}${request.entry.subject.description}`;
};

const groupBlock = (request: {
  readonly group: ChangeGroup;
  readonly entries: readonly ChangeEntry[];
}): readonly string[] => {
  const lines = request.entries
    .filter((entry) => changelogGroupOf({ entry }) === request.group)
    .map((entry) => lineOf({ entry }));
  return lines.length === 0 ? [] : [`### ${request.group}`, "", ...lines, ""];
};

const headingOf = (request: { readonly version: string }): string =>
  `${SECTION_HEADING_PREFIX}${request.version}`;

export const changelogSectionOf = (request: {
  readonly version: string;
  readonly entries: readonly ChangeEntry[];
}): string =>
  [
    headingOf(request),
    "",
    ...GROUPS_IN_ORDER.flatMap((group) => groupBlock({ group, entries: request.entries })),
  ].join("\n");

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
