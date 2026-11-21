import type { ClauseRoot } from "../../../domain/settings/selection/selection.ts";
import type { Finding } from "../../../domain/finding/governance.ts";
import type { FileTextPort } from "../../node/file-system/file-text-port.ts";
import type { PathPort } from "../../node/path-port.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "../../command-line/assessment-file.ts";
import { type ClauseAddress, clauseAddressText } from "../../discipline-exceptions-folder/clause-address.ts";
import { type PackageLink, packageLinkOf } from "../../command-line/installation/package-link.ts";
import { shownPathOf } from "../../command-line/installation/shown-path.ts";
import type { AssessmentFileNote, AssessmentSection, ClauseReading, ReadFirstEntry } from "../../../domain/report/check-report.ts";

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

const failingClauses = (request: { readonly findings: readonly Finding[] }): readonly ClauseAddress[] => [
  ...new Map(request.findings.map((finding) => [clauseAddressText({ address: finding.clause }), finding.clause])).values(),
];

const closesFence = (request: { readonly fence: string; readonly line: string }): "closes" | "stays-open" =>
  request.line.trim().startsWith(request.fence) && request.line.trim().replaceAll(request.fence.charAt(0), "") === ""
    ? "closes"
    : "stays-open";

const scannedLine = (scan: HeadingScan, line: string): HeadingScan => {
  if (scan.fence !== undefined) {
    return closesFence({ fence: scan.fence, line }) === "closes" ? { ...scan, fence: undefined } : scan;
  }
  const opening = FENCE_OPENING.exec(line)?.[1];
  return opening === undefined ? { ...scan, headings: [...scan.headings, line.trimEnd()] } : { ...scan, fence: opening };
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
  return request.headings.headings.has(assessmentSectionHeading(request)) ? "present" : "not-assessed";
};

type ShownPageRequest = ReadingRequest & { readonly link: PackageLink };

const shownPageOf = (request: ShownPageRequest & { readonly page: string }): string =>
  shownPathOf({ path: request.path, repoRoot: request.repoRoot, link: request.link, target: request.page });

const clauseReadingOf = (
  request: ShownPageRequest & { readonly headings: AssessmentHeadings; readonly clause: ClauseAddress; readonly page: string },
): ClauseReading => ({
  kind: "clause",
  clause: request.clause,
  assessmentSection: assessmentSectionOf(request),
  rulePage: { path: shownPageOf(request), presence: request.fileText.exists({ path: request.page }) },
});

const rulePageOf = (request: { readonly root: ClauseRoot; readonly path: PathPort }): string =>
  request.path.join({ segments: [request.root.ruleSetRoot, "rules", request.root.clause.discipline, "README.md"] });

const assessmentFileNotes = (
  request: ShownPageRequest & { readonly headings: AssessmentHeadings; readonly installRoot: AbsolutePath },
): readonly AssessmentFileNote[] =>
  request.headings.file === "read"
    ? []
    : [
        {
          kind: "assessment-file",
          state: request.headings.file,
          guide: shownPageOf({ ...request, page: request.path.join({ segments: [request.installRoot, ADOPTING_GUIDE] }) }),
        },
      ];

export const clauseReadingsOf = (
  request: ReadingRequest & {
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
  const link = packageLinkOf(request);
  return [
    ...assessmentFileNotes({ ...request, headings, link }),
    ...clauses.flatMap((clause) =>
      request.clauseRoots
        .filter((root) => clauseAddressText({ address: root.clause }) === clauseAddressText({ address: clause }))
        .map((root) => clauseReadingOf({ ...request, headings, link, clause, page: rulePageOf({ root, path: request.path }) })),
    ),
  ];
};
