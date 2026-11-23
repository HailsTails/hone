import {
  VERSION_TWO_CHECK,
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
  type RunSectionName,
  runSectionRoleOf,
} from "../../src/domain/report/report-sections.ts";
import type { RunReport } from "../../src/domain/report/run-report.ts";
import type { CommandOutcome } from "../../src/infrastructure/command-line/outcomes/command-outcome.ts";
import { renderRunSectionsText } from "../../src/infrastructure/printed-report/run-report-text.ts";

type VersionTwoChecked = { readonly sections: string; readonly report: RunReport };

const REPORTED_NOT_GATED: readonly RunSectionName[] = ["findings", "unrecorded"];

export const VERSION_TWO_GATED_SECTIONS: readonly RunSectionName[] = RUN_SECTION_NAMES.filter(
  (section) => runSectionRoleOf({ section }) === "failing" && !REPORTED_NOT_GATED.includes(section),
);

const gateLineOf = (request: {
  readonly findings: number;
  readonly unrecorded: number;
  readonly failing: readonly string[];
}): string =>
  request.failing.length > 0
    ? `self-check: fail, gated sections hold entries: ${request.failing.join(", ")}\n`
    : `self-check: pass, the selection, records and projection are sound; findings (${request.findings}) and unrecorded (${request.unrecorded}) are reported above and not gated\n`;

export const versionTwoSelfCheckOutcomeOf = (request: {
  readonly checked: VersionTwoChecked;
}): CommandOutcome => {
  const { report, sections } = request.checked;
  const failing = VERSION_TWO_GATED_SECTIONS.filter((section) => report[section].length > 0).map(
    (section) => `${section} (${report[section].length})`,
  );
  return {
    code: failing.length > 0 ? 1 : 0,
    text: `${sections}${gateLineOf({ findings: report.findings.length, unrecorded: report.unrecorded.length, failing })}`,
  };
};

const selfCheckSubcommandsOf = (ports: ToolPorts): Subcommands => ({
  ...toolSubcommandsOf(ports),
  check: namedSettingsCommandOf({
    ports,
    run: commandOf({
      tool: {
        ...VERSION_TWO_CHECK,
        print: (request) =>
          versionTwoSelfCheckOutcomeOf({
            checked: {
              sections: renderRunSectionsText(versionTwoReportRequestOf(request)),
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
