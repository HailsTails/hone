import {
  VERSION_TWO_CHECK,
  type VersionTwoCheckRun,
  versionTwoReportRequestOf,
} from "../../src/composition/check-command.ts";
import {
  type CommandHandler,
  commandOf,
  type Subcommands,
  toolCommandOf,
} from "../../src/composition/composed-command.ts";
import { INSTALLED_PORTS, toolSubcommandsOf } from "../../src/composition/run-tool-command.ts";
import type { ToolPorts } from "../../src/composition/tool-ports.ts";
import { namedSettingsCommandOf } from "../../src/composition/version-chosen-command.ts";
import {
  RUN_SECTION_NAMES,
  runSectionRoleOf,
  type RunVerdict,
  runVerdictOf,
} from "../../src/domain/report/report-sections.ts";
import type { RunReport } from "../../src/domain/report/run-report.ts";
import type { CommandOutcome } from "../../src/infrastructure/command-line/outcomes/command-outcome.ts";
import {
  type AssessmentScope,
  assessmentScopeOf,
  renderRunSectionsText,
} from "../../src/infrastructure/printed-report/run-report-text.ts";

const failingSectionsOf = ({ report }: { readonly report: RunReport }): readonly string[] => {
  const failed = RUN_SECTION_NAMES.filter(
    (section) => runSectionRoleOf({ section }) === "failing" && report[section].length > 0,
  ).map((section) => `${section} (${report[section].length})`);
  const comparisons = report.debtComparison?.issues.length ?? 0;
  return comparisons === 0 ? failed : [...failed, `debt comparison (${comparisons})`];
};

const gateLineOf = (request: {
  readonly verdict: RunVerdict;
  readonly scope: AssessmentScope;
  readonly report: RunReport;
}): string =>
  request.verdict === "fail"
    ? `self-check: fail${request.scope}, failing sections hold entries: ${failingSectionsOf(request).join(", ")}\n`
    : `self-check: pass${request.scope}, no failing section holds an entry\n`;

export const versionTwoSelfCheckOutcomeOf = (request: {
  readonly ports: Pick<ToolPorts, "path" | "fileText">;
  readonly produced: VersionTwoCheckRun;
}): CommandOutcome => {
  const { report } = request.produced.run;
  const verdict = runVerdictOf({ report });
  return {
    code: verdict === "pass" ? 0 : 1,
    text: `${renderRunSectionsText(versionTwoReportRequestOf(request))}${gateLineOf({ verdict, scope: assessmentScopeOf({ report }), report })}`,
  };
};

const selfCheckSubcommandsOf = (ports: ToolPorts): Subcommands => ({
  ...toolSubcommandsOf(ports),
  check: namedSettingsCommandOf({
    ports,
    run: commandOf({
      tool: {
        ...VERSION_TWO_CHECK,
        print: versionTwoSelfCheckOutcomeOf,
      },
      ports,
    }),
  }),
});

export const runSelfCheck: CommandHandler = toolCommandOf({
  subcommands: selfCheckSubcommandsOf(INSTALLED_PORTS),
  ports: INSTALLED_PORTS,
});
