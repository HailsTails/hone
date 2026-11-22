import {
  GUIDED_CHECK,
  VERSION_TWO_CHECK,
  type VersionTwoChecked,
} from "../../src/composition/check-command.ts";
import {
  type CommandHandler,
  commandOf,
  type Subcommands,
  toolCommandOf,
} from "../../src/composition/composed-command.ts";
import { INSTALLED_PORTS, toolSubcommandsOf } from "../../src/composition/run-tool-command.ts";
import type { ToolPorts } from "../../src/composition/tool-ports.ts";
import { versionChosenCommandOf } from "../../src/composition/version-chosen-command.ts";
import type { CheckReport } from "../../src/domain/report/check-report.ts";
import type { LoadFailure } from "../../src/domain/report/load-failure.ts";
import {
  RUN_SECTION_NAMES,
  type RunSectionName,
  runSectionRoleOf,
} from "../../src/domain/report/report-sections.ts";
import type { Result } from "../../src/domain/result.ts";
import {
  type GuidedCheckRun,
  guidedCheckCommandOutcome,
} from "../../src/infrastructure/command-line/outcomes/check-command-outcome.ts";
import type { CommandOutcome } from "../../src/infrastructure/command-line/outcomes/command-outcome.ts";

type GatedSection =
  | "uncovered"
  | "stale"
  | "forfeited"
  | "doublyHeld"
  | "invalidRecords"
  | "unmeasured"
  | "projectionProblems";

const GATED_SECTIONS: readonly GatedSection[] = [
  "uncovered",
  "stale",
  "forfeited",
  "doublyHeld",
  "invalidRecords",
  "unmeasured",
  "projectionProblems",
];

const REPORTED_NOT_GATED: readonly RunSectionName[] = ["findings", "unrecorded"];

export const VERSION_TWO_GATED_SECTIONS: readonly RunSectionName[] = RUN_SECTION_NAMES.filter(
  (section) => runSectionRoleOf({ section }) === "failing" && !REPORTED_NOT_GATED.includes(section),
);

const failingGatesOf = (request: { readonly report: CheckReport }): readonly string[] =>
  GATED_SECTIONS.filter((section) => request.report[section].length > 0).map(
    (section) => `${section} (${request.report[section].length})`,
  );

const gateLineOf = (request: {
  readonly findings: number;
  readonly unrecorded: number;
  readonly failing: readonly string[];
}): string =>
  request.failing.length > 0
    ? `self-check: fail, gated sections hold entries: ${request.failing.join(", ")}\n`
    : `self-check: pass, the selection, records and projection are sound; findings (${request.findings}) and unrecorded (${request.unrecorded}) are reported above and not gated\n`;

export const selfCheckOutcomeOf = (request: {
  readonly result: Result<GuidedCheckRun, LoadFailure>;
}): CommandOutcome => {
  const checked = guidedCheckCommandOutcome(request);
  if (request.result.outcome === "failed") {
    return checked;
  }
  const { report } = request.result.value;
  const failing = failingGatesOf({ report });
  return {
    code: failing.length > 0 ? 1 : 0,
    text: `${checked.text}${gateLineOf({ findings: report.findings.length, unrecorded: report.unrecorded.length, failing })}`,
  };
};

export const versionTwoSelfCheckOutcomeOf = (request: {
  readonly checked: VersionTwoChecked;
}): CommandOutcome => {
  const { report, outcome } = request.checked;
  const failing = VERSION_TWO_GATED_SECTIONS.filter((section) => report[section].length > 0).map(
    (section) => `${section} (${report[section].length})`,
  );
  return {
    code: failing.length > 0 ? 1 : 0,
    text: `${outcome.text}${gateLineOf({ findings: report.findings.length, unrecorded: report.unrecorded.length, failing })}`,
  };
};

const selfCheckSubcommandsOf = (ports: ToolPorts): Subcommands => ({
  ...toolSubcommandsOf(ports),
  check: versionChosenCommandOf({
    ports,
    versionOne: commandOf({
      tool: {
        ...GUIDED_CHECK,
        print: ({ produced }) => selfCheckOutcomeOf({ result: { outcome: "ok", value: produced } }),
      },
      ports,
    }),
    versionTwo: commandOf({
      tool: {
        ...VERSION_TWO_CHECK,
        print: (request) =>
          versionTwoSelfCheckOutcomeOf({
            checked: {
              outcome: VERSION_TWO_CHECK.print(request),
              report: request.produced.run.report,
            },
          }),
      },
      ports,
    }),
  }),
});

export const runSelfCheck: CommandHandler = toolCommandOf({
  subcommands: selfCheckSubcommandsOf(INSTALLED_PORTS),
  ports: INSTALLED_PORTS,
});
