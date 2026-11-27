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
import { summariseRunFailures } from "../../src/domain/report/report-sections.ts";
import type { CommandOutcome } from "../../src/infrastructure/command-line/outcomes/command-outcome.ts";
import {
  assessmentScopeOf,
  renderRunSectionsText,
} from "../../src/infrastructure/printed-report/run-report-text.ts";

export const versionTwoSelfCheckOutcomeOf = (request: {
  readonly ports: Pick<ToolPorts, "path" | "fileText">;
  readonly produced: VersionTwoCheckRun;
}): CommandOutcome => {
  const { report } = request.produced.run;
  const { verdict, sections } = summariseRunFailures({ report });
  const scope = assessmentScopeOf({ report });
  const failing = sections.map(
    ({ name, count }) => `${name === "debtComparison" ? "debt comparison" : name} (${count})`,
  );
  const gate =
    verdict === "fail"
      ? `self-check: fail${scope}, failing sections hold entries: ${failing.join(", ")}\n`
      : `self-check: pass${scope}, no failing section holds an entry\n`;
  return {
    code: verdict === "pass" ? 0 : 1,
    text: `${renderRunSectionsText(versionTwoReportRequestOf(request))}${gate}`,
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
