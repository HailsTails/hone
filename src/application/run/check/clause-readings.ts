import type { Finding } from "../../../domain/finding/governance.ts";
import {
  type AddressedCheck,
  checkAddressTextOf,
} from "../../../domain/language-layer/check-address-text.ts";
import { checkItemSegments } from "../../../domain/language-layer/symptom-catalogue-location.ts";
import {
  ASSESSMENT_FILE_NAME,
  assessmentSectionHeading,
} from "../../../domain/report/assessment-file.ts";
import type {
  AssessmentFileNote,
  AssessmentSection,
  ClausePage,
  ClauseReading,
  ReadFirstEntry,
} from "../../../domain/report/check-report.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { ClauseRoot } from "../../../domain/settings/selection/selection.ts";
import type { FileTextPort } from "../../ports/file-system/file-text-port.ts";
import type { PathPort } from "../../ports/host/path-port.ts";
import type { ShownPathOf } from "../../ports/installation/shown-path-of.ts";

type AssessmentHeadings =
  | { readonly file: "read"; readonly headings: ReadonlySet<string> }
  | { readonly file: AssessmentFileNote["state"] };

type ReadingRequest = {
  readonly repoRoot: AbsolutePath;
  readonly fileText: Pick<FileTextPort, "read" | "exists">;
  readonly path: PathPort;
};

type HeadingScan = { readonly fence: string | undefined; readonly headings: readonly string[] };

const BYTE_ORDER_MARK = /^\uFEFF/u;

const FENCE_OPENING = /^ {0,3}(`{3,}|~{3,})/;

const ADOPTING_GUIDE = "ADOPTING.md";

const FIX_HEADING = "## Fix";

const failingClauses = (request: {
  readonly findings: readonly Finding[];
}): readonly ClauseAddress[] => [
  ...new Map(
    request.findings.map((finding) => [
      clauseAddressText({ address: finding.clause }),
      finding.clause,
    ]),
  ).values(),
];

const closesFence = (request: {
  readonly fence: string;
  readonly line: string;
}): "closes" | "stays-open" =>
  request.line.trim().startsWith(request.fence) &&
  request.line.trim().replaceAll(request.fence.charAt(0), "") === ""
    ? "closes"
    : "stays-open";

const scannedLine = (scan: HeadingScan, line: string): HeadingScan => {
  if (scan.fence !== undefined) {
    return closesFence({ fence: scan.fence, line }) === "closes"
      ? { ...scan, fence: undefined }
      : scan;
  }
  const opening = FENCE_OPENING.exec(line)?.[1];
  return opening === undefined
    ? { ...scan, headings: [...scan.headings, line.trimEnd()] }
    : { ...scan, fence: opening };
};

const headingLinesOf = (request: { readonly text: string }): ReadonlySet<string> =>
  new Set(
    request.text
      .replace(BYTE_ORDER_MARK, "")
      .split("\n")
      .reduce<HeadingScan>(scannedLine, { fence: undefined, headings: [] }).headings,
  );

const assessmentHeadingsOf = (request: ReadingRequest): AssessmentHeadings => {
  const assessmentPath = request.path.join({ segments: [request.repoRoot, ASSESSMENT_FILE_NAME] });
  if (request.fileText.exists({ path: assessmentPath }) === "absent") {
    return { file: "not-written" };
  }
  const text = request.fileText.read({ path: assessmentPath });
  if (text.outcome === "failed") {
    return { file: "unreadable" };
  }
  return { file: "read", headings: headingLinesOf({ text: text.value }) };
};

const assessmentSectionOf = (request: {
  readonly headings: AssessmentHeadings;
  readonly clause: ClauseAddress;
}): AssessmentSection => {
  if (request.headings.file !== "read") {
    return "unread";
  }
  return request.headings.headings.has(assessmentSectionHeading(request))
    ? "present"
    : "not-assessed";
};

type ShownPageRequest = ReadingRequest & { readonly shownPathOf: ShownPathOf };

const shownPageOf = (request: ShownPageRequest & { readonly page: string }): string =>
  request.shownPathOf({ target: request.page });

const rulePageOf = (request: ShownPageRequest & { readonly root: ClauseRoot }): ClausePage => {
  const page = request.path.join({
    segments: [request.root.ruleSetRoot, "rules", request.root.clause.discipline, "README.md"],
  });
  return {
    path: shownPageOf({ ...request, page }),
    presence: request.fileText.exists({ path: page }),
    section: "spirit",
  };
};

const fixSectionOf = (
  request: ReadingRequest & { readonly page: string },
): ClausePage["section"] => {
  const text = request.fileText.read({ path: request.page });
  return text.outcome === "ok" && headingLinesOf({ text: text.value }).has(FIX_HEADING)
    ? "fix"
    : "whole-page";
};

const checkPageOf = (
  request: ShownPageRequest & { readonly root: ClauseRoot; readonly check: AddressedCheck },
): ClausePage => {
  const page = request.path.join({
    segments: [request.root.ruleSetRoot, ...checkItemSegments(request)],
  });
  const path = shownPageOf({ ...request, page });
  return request.fileText.exists({ path: page }) === "absent"
    ? { path, presence: "absent", section: "whole-page" }
    : { path, presence: "present", section: fixSectionOf({ ...request, page }) };
};

const checksFoundBy = (request: {
  readonly root: ClauseRoot;
  readonly findings: readonly Finding[];
}): readonly AddressedCheck[] => {
  const named = new Set(request.findings.map((finding) => finding.check));
  const found = request.root.checks.filter((check) => named.has(checkAddressTextOf({ check })));
  return named.has(undefined) || found.length === 0 ? request.root.checks : found;
};

const clausePagesOf = (
  request: ShownPageRequest & { readonly root: ClauseRoot; readonly findings: readonly Finding[] },
): readonly ClausePage[] =>
  request.root.checks.length === 0
    ? [rulePageOf(request)]
    : checksFoundBy(request).map((check) => checkPageOf({ ...request, check }));

const clauseReadingOf = (
  request: ShownPageRequest & {
    readonly headings: AssessmentHeadings;
    readonly clause: ClauseAddress;
    readonly root: ClauseRoot;
    readonly findings: readonly Finding[];
  },
): ClauseReading => ({
  kind: "clause",
  clause: request.clause,
  assessmentSection: assessmentSectionOf(request),
  pages: clausePagesOf(request),
});

const assessmentFileNotes = (
  request: ShownPageRequest & {
    readonly headings: AssessmentHeadings;
    readonly installRoot: AbsolutePath;
  },
): readonly AssessmentFileNote[] =>
  request.headings.file === "read"
    ? []
    : [
        {
          kind: "assessment-file",
          state: request.headings.file,
          guide: shownPageOf({
            ...request,
            page: request.path.join({ segments: [request.installRoot, ADOPTING_GUIDE] }),
          }),
        },
      ];

const findingsOf = (request: {
  readonly findings: readonly Finding[];
  readonly clause: ClauseAddress;
}): readonly Finding[] =>
  request.findings.filter(
    (finding) =>
      clauseAddressText({ address: finding.clause }) ===
      clauseAddressText({ address: request.clause }),
  );

export const clauseReadingsOf = (
  request: ShownPageRequest & {
    readonly installRoot: AbsolutePath;
    readonly findings: readonly Finding[];
    readonly clauseRoots: readonly ClauseRoot[];
  },
): readonly ReadFirstEntry[] => {
  const clauses = failingClauses(request);
  if (clauses.length === 0) {
    return [];
  }
  const headings = assessmentHeadingsOf(request);
  return [
    ...assessmentFileNotes({ ...request, headings }),
    ...clauses.flatMap((clause) =>
      request.clauseRoots
        .filter(
          (root) =>
            clauseAddressText({ address: root.clause }) === clauseAddressText({ address: clause }),
        )
        .map((root) =>
          clauseReadingOf({
            ...request,
            headings,
            clause,
            root,
            findings: findingsOf({ findings: request.findings, clause }),
          }),
        ),
    ),
  ];
};
