import type { AttributedNativeException, Finding } from "../../../domain/finding/governance.ts";
import { clauseAddressText } from "../../../domain/rule-set/clause-address.ts";
import type { CheckReport } from "../../../domain/report/check-report.ts";
import { verdictOf } from "../../../domain/report/verdict.ts";
import type { ExceptionRecord } from "../../../domain/records/discipline-exceptions/exception-record.ts";
import { joinedKey, type SectionKeys, uniqueKeys } from "./section-keys.ts";

export const findingKeyOf = (request: { readonly finding: Pick<Finding, "file" | "anchor">; readonly clauseText: string }): string =>
  joinedKey({ parts: [request.clauseText, request.finding.file, `${request.finding.anchor.line}:${request.finding.anchor.column}`] });

const VERSION_TWO_KIND_OF_VERSION_ONE: Readonly<Record<ExceptionRecord["kind"], string>> = {
  "file-carve-out": "debt",
  "authorised-location": "authorised-location",
  "clause-wide-carve-out": "clause-wide-carve-out",
};

export const answeredKeyOf = (request: { readonly findingKey: string; readonly kinds: readonly string[] }): string =>
  joinedKey({ parts: [request.findingKey, "answered by", uniqueKeys({ keys: request.kinds }).toSorted().join(",")] });

const placeOfNative = (request: { readonly exception: AttributedNativeException }): string => {
  const { exception } = request;
  switch (exception.kind) {
    case "command-line-option":
      return joinedKey({ parts: [exception.location, exception.script, exception.option] });
    case "inline-disable":
    case "inline-rule-config":
      return `${exception.file}:${exception.line}`;
    case "ignore":
    case "config-override":
    case "suppression-entry":
      return exception.file;
  }
};

export const nativeKeyOf = (request: { readonly exception: AttributedNativeException }): string =>
  joinedKey({
    parts: [request.exception.mechanism, request.exception.kind, clauseAddressText({ address: request.exception.clause }), placeOfNative(request)],
  });

const recordFileKeyOf = (request: { readonly record: ExceptionRecord }): string =>
  request.record.kind === "clause-wide-carve-out" ? clauseAddressText({ address: request.record.clause }) : request.record.file;

export const beforeSectionsOf = (request: { readonly report: CheckReport }): SectionKeys => {
  const { report } = request;
  return {
    excluded: report.excluded,
    findings: report.findings.map((finding) => findingKeyOf({ finding, clauseText: clauseAddressText({ address: finding.clause }) })),
    answered: report.exempted.map(({ finding, by }) =>
      answeredKeyOf({
        findingKey: findingKeyOf({ finding, clauseText: clauseAddressText({ address: finding.clause }) }),
        kinds: by.map((record) => VERSION_TWO_KIND_OF_VERSION_ONE[record.kind]),
      }),
    ),
    unrecorded: report.unrecorded.map((exception) => nativeKeyOf({ exception })),
    misnamed: [],
    paid: [],
    stale: report.stale.map((record) => recordFileKeyOf({ record })),
    forfeited: report.forfeited.map((record) => recordFileKeyOf({ record })),
    "doubly-held": report.doublyHeld.map(({ clause, file, mechanism }) => joinedKey({ parts: [clauseAddressText({ address: clause }), file, mechanism] })),
    "invalid-records": report.invalidRecords.map(({ place }) => joinedKey({ parts: [place.file, place.index] })),
    uncovered: uniqueKeys({ keys: report.uncovered.map((address) => clauseAddressText({ address })) }),
    "not-adopted": uniqueKeys({ keys: report.notAdopted.map((address) => clauseAddressText({ address })) }),
    "not-run": uniqueKeys({ keys: report.notRun.map((address) => clauseAddressText({ address })) }),
    editions: uniqueKeys({
      keys: report.editions.map(({ address, mechanism, edition, latest }) => joinedKey({ parts: [clauseAddressText({ address }), mechanism, edition, latest] })),
    }),
    unmeasured: report.unmeasured.map((unmeasured) =>
      unmeasured.kind === "mechanism-not-run" ? joinedKey({ parts: [unmeasured.mechanism, "not-run", unmeasured.projection] }) : unmeasured.kind,
    ),
    "projection-problems": report.projectionProblems.map((problem) =>
      joinedKey({ parts: [problem.scope, problem.mechanism, problem.state, problem.scope === "slice" ? problem.slice : ""] }),
    ),
    assessment: report.assessment.map(({ concern, assessedBy }) => joinedKey({ parts: [concern, assessedBy] })),
    verdict: [verdictOf({ report })],
  };
};
