import type { Result } from "../../src/domain/result.ts";

export const CHANGE_TYPES = [
  "feat",
  "fix",
  "perf",
  "revert",
  "docs",
  "refactor",
  "test",
  "build",
  "ci",
  "chore",
  "style",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export type Compatibility = "compatible" | "breaking";

export type ConventionalSubject = {
  readonly type: ChangeType;
  readonly scope: string | undefined;
  readonly compatibility: Compatibility;
  readonly description: string;
};

export type SubjectRejection =
  | { readonly kind: "unshaped" }
  | { readonly kind: "unknown-type"; readonly type: string };

export type ChangeEntry =
  | { readonly kind: "conventional"; readonly subject: ConventionalSubject }
  | {
      readonly kind: "unclassified";
      readonly subject: string;
      readonly compatibility: Compatibility;
    };

const SUBJECT_SHAPE =
  /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9][a-z0-9._/-]*)\))?(?<breaking>!)?: (?<description>\S.*)$/;

const changeTypeOf = (request: { readonly type: string }): ChangeType | undefined =>
  CHANGE_TYPES.find((type) => type === request.type);

export const conventionalSubjectOf = (request: {
  readonly subject: string;
}): Result<ConventionalSubject, SubjectRejection> => {
  const groups = SUBJECT_SHAPE.exec(request.subject)?.groups;
  if (groups?.type === undefined || groups.description === undefined) {
    return { outcome: "failed", error: { kind: "unshaped" } };
  }
  const type = changeTypeOf({ type: groups.type });
  if (type === undefined) {
    return { outcome: "failed", error: { kind: "unknown-type", type: groups.type } };
  }
  return {
    outcome: "ok",
    value: {
      type,
      scope: groups.scope,
      compatibility: groups.breaking === undefined ? "compatible" : "breaking",
      description: groups.description,
    },
  };
};

const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /;

const LINE_BREAK = "\n";

const footerCompatibilityOf = (request: { readonly bodyLines: readonly string[] }): Compatibility =>
  request.bodyLines.some((line) => BREAKING_FOOTER.test(line)) ? "breaking" : "compatible";

const combinedCompatibility = (request: {
  readonly subject: Compatibility;
  readonly footer: Compatibility;
}): Compatibility =>
  request.subject === "breaking" || request.footer === "breaking" ? "breaking" : "compatible";

export const changeEntryOf = (request: { readonly message: string }): ChangeEntry => {
  const [subject, ...bodyLines] = request.message.split(LINE_BREAK);
  const footer = footerCompatibilityOf({ bodyLines });
  const conventional = conventionalSubjectOf({ subject });
  return conventional.outcome === "ok"
    ? {
        kind: "conventional",
        subject: {
          ...conventional.value,
          compatibility: combinedCompatibility({
            subject: conventional.value.compatibility,
            footer,
          }),
        },
      }
    : { kind: "unclassified", subject, compatibility: footer };
};
