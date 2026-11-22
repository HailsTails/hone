import { versionOneEngineNameOf } from "../../domain/rule-set/engine-id.ts";
import { recordImportOf } from "../../domain/records/discipline-exceptions/exception-entry.ts";
import type { ExceptionRecord, InvalidRecord, RecordPlace } from "../../domain/records/discipline-exceptions/exception-record.ts";
import type { AttributedNativeException } from "../../domain/finding/governance.ts";
import type { ExemptedFinding } from "../../domain/records/discipline-exceptions/governance.ts";
import type { InlineReach, ScriptOptionCause } from "../../domain/runner/runner-result-types.ts";
import { PRUNE_DEBT_SUBCOMMAND } from "../command-line/arguments/subcommand-names.ts";
import { clauseAddressText } from "../../domain/rule-set/clause-address.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import type { RepoPath } from "../../domain/repository/repo-path-types.ts";
import { NESTED_CONFIGURATION_ISSUE } from "../command-line/nested-configuration-issue.ts";
import type { ReportOutput } from "../../domain/settings/report-output.ts";
import { ASSESSMENT_FILE_NAME, assessmentSectionHeading } from "../../domain/report/assessment-file.ts";
import type { BaseRevisionAvailability } from "../../domain/repository/base-revision-availability.ts";
import type {
  AssessmentFileNote,
  CheckReport,
  ClausePage,
  ClauseReading,
  PaidDebtNote,
  PartialAssessment,
  ProjectionProblem,
  ReadFirstEntry,
  Unmeasured,
} from "../../domain/report/check-report.ts";
import { SECTION_NAMES, type SectionName } from "../../domain/report/section-roles.ts";
import { printedSectionLines, type ReportSection } from "./section-selection.ts";
import { verdictOf } from "../../domain/report/verdict.ts";
import { escapedLineBreaks, locatedFindingLine, symptomFindingLine } from "./findings/finding-line.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide, symptomNoteLinesOf, symptomReadingIn } from "./symptoms/symptom-notes.ts";

const importNote = (request: { readonly record: ExceptionRecord }): string => {
  const recordImport = recordImportOf(request);
  return recordImport.imported === "yes" ? ` imported from ${recordImport.source}` : "";
};

const exemptedLine = (request: { readonly exempted: ExemptedFinding }): string =>
  `${locatedFindingLine({ finding: request.exempted.finding })}${request.exempted.by
    .map((record) => ` exempted by ${record.kind}${importNote({ record })}`)
    .join("")}`;

const recordFile = (request: { readonly record: ExceptionRecord }): string => {
  switch (request.record.kind) {
    case "authorised-location":
    case "file-carve-out":
      return request.record.file;
    case "clause-wide-carve-out":
      return "*";
  }
};

const recordLine = (request: { readonly record: ExceptionRecord }): string =>
  `${clauseAddressText({ address: request.record.clause })} ${versionOneEngineNameOf(request.record.mechanism)} ${request.record.kind} ${recordFile(request)}`;

const INLINE_REACH_NOTE: Readonly<Record<InlineReach, string>> = {
  "one-clause": "",
  "every-selected-clause": " names no rule and escapes every selected clause: naming the rule is the cheap fix",
};

const UNJUDGED_OPTION = "so Hone cannot tell what the option does to the files under check";

const scriptOptionNote = (request: { readonly cause: ScriptOptionCause }): string => {
  switch (request.cause.kind) {
    case "weakens-run":
      return " weakens the script's whole run, so no record can cover it: remove it from the script";
    case "after-another-command":
      return `: ${request.cause.command} is not the first command of its script, ${UNJUDGED_OPTION}; give ${request.cause.command} a script of its own, such as ${quoted({ text: request.cause.invocation })}`;
    case "wrapped":
      return `: ${quoted({ text: request.cause.wrapper })} comes before ${request.cause.command} and is neither a package runner nor a NAME=value setting, ${UNJUDGED_OPTION}; put only package runners and NAME=value settings before ${request.cause.command}`;
    case "unreadable":
      return `: a quote in the script has no partner, so Hone cannot read what the script passes to ${request.cause.command} or tell what that does to the files under check; pair every quote in the script`;
  }
};

const inlineDetail = (request: {
  readonly exception: { readonly file: string; readonly line: number; readonly text: string };
}): string => `${request.exception.file}:${request.exception.line} ${escapedLineBreaks({ text: request.exception.text })}`;

const unrecordedDetail = (request: { readonly exception: AttributedNativeException }): string => {
  switch (request.exception.kind) {
    case "ignore":
    case "config-override":
      return request.exception.file;
    case "suppression-entry":
      return `${request.exception.file} ${request.exception.location}`;
    case "inline-disable":
      return `${inlineDetail({ exception: request.exception })}${INLINE_REACH_NOTE[request.exception.reach]}`;
    case "inline-rule-config":
      return inlineDetail({ exception: request.exception });
    case "command-line-option":
      return `${request.exception.location} ${escapedLineBreaks({ text: request.exception.script })} ${escapedLineBreaks({ text: request.exception.option })}${scriptOptionNote({ cause: request.exception.cause })}`;
  }
};

const unrecordedLine = (request: { readonly exception: AttributedNativeException }): string =>
  `${clauseAddressText({ address: request.exception.clause })} ${versionOneEngineNameOf(request.exception.mechanism)} ${request.exception.kind} ${unrecordedDetail(request)}`;

const placeText = (request: { readonly place: RecordPlace; readonly form: "entry" | "index" }): string => {
  const { place } = request;
  if (place.layout === "split") {
    return `${place.file} exceptions[${place.index}]`;
  }
  return request.form === "entry" ? `exceptions[${place.index}]` : `${place.index}`;
};

const invalidDetail = (request: { readonly problem: InvalidRecord["problem"] }): string => {
  switch (request.problem.kind) {
    case "clause-unparseable":
    case "why-chain-refused":
    case "evidence-refused":
    case "import-unverified":
      return escapedLineBreaks({ text: request.problem.detail });
    case "clause-not-selected":
    case "clause-not-adopted":
    case "clause-not-run":
    case "non-exemptible-clause":
      return clauseAddressText({ address: request.problem.clause });
    case "file-not-repo-path":
      return escapedLineBreaks({ text: request.problem.file });
    case "duplicate":
      return `of ${placeText({ place: request.problem.of, form: "index" })}`;
  }
};

type BaseDependentUnmeasured = Extract<Unmeasured, { readonly base: BaseRevisionAvailability }>;

type MechanismNotRun = Extract<Unmeasured, { readonly kind: "mechanism-not-run" }>;

const PASS_A_BASE = "pass --base-revision with the branch's base, such as origin/main";

const LEAVE_DECAY_ELSEWHERE =
  'leave decay to another run with "assessment": { "forfeiture": "elsewhere" } in disciplines.json or --forfeiture elsewhere';

const RECORDS_AT_BASE = "Hone needs the exception records as they were at that revision";

type BaseNeeds = {
  readonly unchecked: string;
  readonly nextStep: string;
  readonly gitAttempt: string;
  readonly needs: string;
};

const BASE_NEEDS: Readonly<Record<BaseDependentUnmeasured["kind"], BaseNeeds>> = {
  "forfeiture-unmeasured": {
    unchecked: "file carve-outs cannot be checked for decay",
    nextStep: `${PASS_A_BASE}, or ${LEAVE_DECAY_ELSEWHERE}`,
    gitAttempt: "list the files changed since that revision",
    needs: `Hone needs that revision and the history back to where this branch left it, or ${LEAVE_DECAY_ELSEWHERE}`,
  },
  "import-unmeasured": {
    unchecked: "imported records cannot be checked against it",
    nextStep: PASS_A_BASE,
    gitAttempt: "read the exception records at that revision",
    needs: RECORDS_AT_BASE,
  },
  "legacy-chain-unmeasured": {
    unchecked: "legacy-chain records cannot be checked against it",
    nextStep: PASS_A_BASE,
    gitAttempt: "read the exception records at that revision",
    needs: RECORDS_AT_BASE,
  },
};

const quoted = (request: { readonly text: string }): string => JSON.stringify(request.text);

const baseDependentLine = (request: { readonly unmeasured: BaseDependentUnmeasured }): string => {
  const { kind, base } = request.unmeasured;
  const needs = BASE_NEEDS[kind];
  switch (base.state) {
    case "not-given":
      return `${kind} no-base-revision: no --base-revision was given, so ${needs.unchecked}; ${needs.nextStep}`;
    case "git-failed":
      return `${kind} base-git-failed ${quoted({ text: base.revision })}: git could not ${needs.gitAttempt} and said ${quoted({ text: base.gitMessage })}; ${needs.needs}`;
  }
};

type NextCommands = { readonly projectCommand: string; readonly pruneCommand: string };

const projectionFileOf = (request: { readonly mechanism: EngineId }): string => `disciplines.${request.mechanism}.mjs`;

const refreshStep = (request: NextCommands & { readonly mechanism: EngineId }): string =>
  `run ${request.projectCommand} and commit every ${projectionFileOf(request)} it writes`;

const GENERATED_CONFIGURATION = "or, where a tool such as sku generates the configuration, last in the configuration the tool takes";

type ReportRequest = NextCommands & { readonly report: CheckReport };

const sliceNote = (request: ReportRequest & { readonly mechanism: EngineId }): string =>
  request.report.projectionProblems.some((problem) => problem.scope === "slice" && problem.mechanism === request.mechanism)
    ? `; the ${request.mechanism} lines under projectionProblems name the package slices involved`
    : "";

const nestedNote = (request: NextCommands & { readonly folders: readonly RepoPath[] }): string =>
  request.folders.length === 0
    ? ""
    : `; ${request.folders.join(", ")} hold their own disciplines.json, and nested Hone configurations are not supported yet (${NESTED_CONFIGURATION_ISSUE}): to govern such a folder from this repository, remove its disciplines.json and keep its records here, then run ${request.projectCommand}, which writes its slice`;

const notIncludedLine = (
  request: ReportRequest & { readonly unmeasured: Extract<MechanismNotRun, { readonly projection: "not-included" }> },
): string => {
  const { mechanism, nestedConfigurations } = request.unmeasured;
  const file = projectionFileOf({ mechanism });
  return `mechanism-not-run ${mechanism} not-included: the ${mechanism} configuration leaves the projection out of effect for a file under check; spread the default export of ${file}, or of a package's own ${file} in that package, last in the configuration that file loads, after every other block (an import placed last without the spread applies nothing), ${GENERATED_CONFIGURATION}${sliceNote({ ...request, mechanism })}${nestedNote({ ...request, folders: nestedConfigurations })}`;
};

const mechanismNotRunLine = (request: ReportRequest & { readonly unmeasured: MechanismNotRun }): string => {
  switch (request.unmeasured.projection) {
    case "missing":
      return `mechanism-not-run ${versionOneEngineNameOf(request.unmeasured.mechanism)} missing: ${projectionFileOf(request.unmeasured)} is not written; ${refreshStep({ ...request, mechanism: request.unmeasured.mechanism })}`;
    case "not-included":
      return notIncludedLine({ ...request, unmeasured: request.unmeasured });
  }
};

type SliceProblem = Extract<ProjectionProblem, { readonly scope: "slice" }>;

const folderOf = (request: { readonly slice: RepoPath }): string => request.slice.split("/").slice(0, -1).join("/");

const sliceProblemReason = (request: NextCommands & { readonly problem: SliceProblem }): string => {
  const { mechanism, slice } = request.problem;
  const folder = folderOf({ slice });
  switch (request.problem.state) {
    case "out-of-date":
      return `that slice differs from what hone project writes now; ${refreshStep({ ...request, mechanism })}`;
    case "missing":
      return `that slice is not written; ${refreshStep({ ...request, mechanism })}`;
    case "not-applied":
      return `the ${mechanism} configuration for ${folder} leaves records of that slice out of effect; spread the default export of ${slice} last in that package's configuration, in place of any other projection it spreads, ${GENERATED_CONFIGURATION}`;
    case "unconfigured":
      return `${folder} has no ${mechanism} configuration file on disk, so nothing loads that slice; run the tool that generates it (for sku, sku configure) before the check`;
  }
};

const projectionProblemLine = (request: NextCommands & { readonly problem: ProjectionProblem }): string => {
  const { problem } = request;
  switch (problem.scope) {
    case "projection":
      return `${versionOneEngineNameOf(problem.mechanism)} ${problem.state}: ${projectionFileOf(problem)} differs from what hone project writes now; ${refreshStep({ ...request, mechanism: problem.mechanism })}`;
    case "slice":
      return `${versionOneEngineNameOf(problem.mechanism)} ${problem.state} ${problem.slice}: ${sliceProblemReason({ ...request, problem })}`;
  }
};

const unmeasuredLine = (request: ReportRequest & { readonly unmeasured: Unmeasured }): string => {
  switch (request.unmeasured.kind) {
    case "forfeiture-unmeasured":
    case "import-unmeasured":
    case "legacy-chain-unmeasured":
      return baseDependentLine({ unmeasured: request.unmeasured });
    case "mechanism-not-run":
      return mechanismNotRunLine({ ...request, unmeasured: request.unmeasured });
  }
};

const counted = (request: { readonly count: number; readonly noun: string }): string =>
  request.count === 1 ? `1 ${request.noun}` : `${request.count} ${request.noun}s`;

const assessmentLine = (request: { readonly partial: PartialAssessment }): string => {
  switch (request.partial.concern) {
    case "forfeiture":
      return `forfeiture ${request.partial.assessedBy}: ${counted({ count: request.partial.fileCarveOuts, noun: "file carve-out" })} not checked for decay in this run`;
  }
};

const sectionRead = (request: { readonly reading: ClauseReading }): string =>
  `read the ${JSON.stringify(assessmentSectionHeading(request.reading))} section of ${ASSESSMENT_FILE_NAME}`;

const PAGE_ANCHORS: Readonly<Record<ClausePage["section"], string>> = { spirit: "#spirit", fix: "#fix", "whole-page": "" };

const PAGE_KINDS: Readonly<Record<ClausePage["section"], string>> = { spirit: "rule page", fix: "check page", "whole-page": "check page" };

const NO_PAGE = "its rule set names no page for it";

const readTargets = (request: { readonly reading: ClauseReading; readonly targets: readonly string[] }): readonly string[] => {
  const sectioned = request.reading.assessmentSection === "present";
  if (request.targets.length === 0) {
    return sectioned ? [sectionRead(request)] : [];
  }
  const pages = request.targets.join(" and ");
  return [sectioned ? `${sectionRead(request)}, then ${pages}` : `read ${pages}`];
};

const pointedReading = (request: { readonly reading: ClauseReading }): string => {
  const targets = request.reading.pages.filter((page) => page.presence === "present").map((page) => `${page.path}${PAGE_ANCHORS[page.section]}`);
  const missing = request.reading.pages
    .filter((page) => page.presence === "absent")
    .map((page) => `its rule set has no ${PAGE_KINDS[page.section]} at ${page.path}`);
  const parts = [...readTargets({ ...request, targets }), ...missing];
  return parts.length === 0 ? NO_PAGE : parts.join("; ");
};

const assessmentContext = (request: { readonly reading: ClauseReading }): string =>
  request.reading.assessmentSection === "not-assessed" ? `; ${ASSESSMENT_FILE_NAME} does not assess this clause` : "";

type SpiritBelow = "rule-pages" | "symptom-rules" | "none";

const SPIRIT_LEADS: Readonly<Record<SpiritBelow, string>> = {
  "rule-pages": "Start from each rule's Spirit below. ",
  "symptom-rules": "Start from the Spirit of each rule its symptom may indicate. ",
  none: "",
};

const presentPagesIn = (request: { readonly entries: readonly ReadFirstEntry[] }): readonly ClausePage[] =>
  request.entries.flatMap((entry) => (entry.kind === "clause" ? entry.pages.filter((page) => page.presence === "present") : []));

const spiritBelowIn = (request: { readonly entries: readonly ReadFirstEntry[] }): SpiritBelow => {
  const pages = presentPagesIn(request);
  if (pages.some((page) => page.section === "spirit")) {
    return "rule-pages";
  }
  return pages.length === 0 ? "none" : "symptom-rules";
};

const assessmentFileState = (request: { readonly note: AssessmentFileNote }): string => {
  switch (request.note.state) {
    case "not-written":
      return `${ASSESSMENT_FILE_NAME}, where this repository records its own causes, forward goal and steps for a clause, is not written yet; ${request.note.guide}#5a-write-the-assessment says how to write it.`;
    case "unreadable":
      return `${ASSESSMENT_FILE_NAME} could not be read.`;
  }
};

const assessmentFileLine = (request: { readonly note: AssessmentFileNote; readonly spiritBelow: SpiritBelow }): string =>
  `${SPIRIT_LEADS[request.spiritBelow]}${assessmentFileState(request)}`;

const reprojectionStep = (request: NextCommands & { readonly projections: readonly EngineId[] }): string =>
  request.projections.length === 0
    ? ", and commit the exception records it changes"
    : `, then run ${request.projectCommand} and commit the exception records with every ${request.projections
        .map((mechanism) => projectionFileOf({ mechanism }))
        .join(" and every ")} it writes`;

const paidDebtLine = (request: NextCommands & { readonly note: PaidDebtNote }): string =>
  `${PRUNE_DEBT_SUBCOMMAND}: ${counted({ count: request.note.fileCarveOuts, noun: "file carve-out" })} under stale or forfeited still ${request.note.fileCarveOuts === 1 ? "records" : "record"} debt that is paid; run ${request.pruneCommand} to remove what is paid${reprojectionStep({ ...request, projections: request.note.projections })}`;

const readFirstLine = (request: NextCommands & { readonly entry: ReadFirstEntry; readonly spiritBelow: SpiritBelow }): string => {
  switch (request.entry.kind) {
    case "assessment-file":
      return assessmentFileLine({ note: request.entry, spiritBelow: request.spiritBelow });
    case "clause":
      return `${clauseAddressText({ address: request.entry.clause })}: ${pointedReading({ reading: request.entry })}${assessmentContext({ reading: request.entry })}`;
    case "paid-debt":
      return paidDebtLine({ ...request, note: request.entry });
  }
};

type GuidedReport = NextCommands & { readonly report: CheckReport; readonly guide: SymptomGuide };

type ReportLines = (request: GuidedReport) => readonly string[];

const SECTION_LINES: Readonly<Record<SectionName, ReportLines>> = {
  excluded: (request) => request.report.excluded,
  notAdopted: (request) => request.report.notAdopted.map((address) => clauseAddressText({ address })),
  notRun: (request) =>
    request.report.notRun.map((address) => `${clauseAddressText({ address })} adopted, mechanism not run: enforced by review`),
  editions: (request) =>
    request.report.editions.map(
      (reading) => `${clauseAddressText({ address: reading.address })} ${versionOneEngineNameOf(reading.mechanism)} edition ${reading.edition} of ${reading.latest}`,
    ),
  findings: (request) =>
    request.report.findings.map((finding) =>
      symptomFindingLine({ finding, reading: symptomReadingIn({ guide: request.guide, finding }) }),
    ),
  exempted: (request) => request.report.exempted.map((exempted) => exemptedLine({ exempted })),
  uncovered: (request) => request.report.uncovered.map((address) => clauseAddressText({ address })),
  stale: (request) => request.report.stale.map((record) => recordLine({ record })),
  forfeited: (request) => request.report.forfeited.map((record) => recordLine({ record })),
  unrecorded: (request) => request.report.unrecorded.map((exception) => unrecordedLine({ exception })),
  doublyHeld: (request) =>
    request.report.doublyHeld.map(
      (held) => `${clauseAddressText({ address: held.clause })} ${versionOneEngineNameOf(held.mechanism)} doubly-held ${held.file}`,
    ),
  invalidRecords: (request) =>
    request.report.invalidRecords.map(
      (invalid) => `${placeText({ place: invalid.place, form: "entry" })} ${invalid.problem.kind} ${invalidDetail(invalid)}`,
    ),
  unmeasured: (request) => request.report.unmeasured.map((unmeasured) => unmeasuredLine({ ...request, unmeasured })),
  projectionProblems: (request) =>
    request.report.projectionProblems.map((problem) => projectionProblemLine({ ...request, problem })),
  assessment: (request) => request.report.assessment.map((partial) => assessmentLine({ partial })),
  readFirst: (request) => {
    const spiritBelow = spiritBelowIn({ entries: request.report.readFirst });
    return [
      ...symptomNoteLinesOf({ guide: request.guide, findings: request.report.findings }),
      ...request.report.readFirst.map((entry) => readFirstLine({ ...request, entry, spiritBelow })),
    ];
  },
};

const reportSections = (request: GuidedReport): readonly ReportSection[] =>
  SECTION_NAMES.map((name) => ({ name, lines: SECTION_LINES[name](request) }));

const verdictLine = (request: { readonly report: CheckReport }): string =>
  request.report.assessment.length === 0
    ? `verdict: ${verdictOf(request)}`
    : `verdict: ${verdictOf(request)} (partial assessment)`;

export const renderGuidedReportText = (request: GuidedReport & { readonly output: ReportOutput }): string => {
  const sectionLines = reportSections(request)
    .filter((section) => section.lines.length > 0)
    .flatMap((section) => printedSectionLines({ output: request.output, section }));
  return `${[...sectionLines, verdictLine(request)].join("\n")}\n`;
};

export const renderReportText = (
  request: NextCommands & { readonly report: CheckReport; readonly output: ReportOutput },
): string => renderGuidedReportText({ ...request, guide: NO_SYMPTOM_GUIDE });
