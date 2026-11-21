import type { ScriptOptionCause } from "../../engines/protocol/runner-module/runner-result-schema.ts";
import { quoted } from "../printed-text.ts";

export type ScriptOptionAdvice = { readonly problem: string; readonly fix: string };

const UNJUDGED_OPTION = "so Hone cannot tell what the option does to the files under check";

export const scriptOptionAdviceOf = (request: { readonly cause: ScriptOptionCause }): ScriptOptionAdvice => {
  const { cause } = request;
  switch (cause.kind) {
    case "weakens-run":
      return { problem: "weakens the script's whole run, so no record can cover it", fix: "remove it from the script" };
    case "after-another-command":
      return {
        problem: `${cause.command} is not the first command of its script, ${UNJUDGED_OPTION}`,
        fix: `give ${cause.command} a script of its own, such as ${quoted({ text: cause.invocation })}`,
      };
    case "wrapped":
      return {
        problem: `${quoted({ text: cause.wrapper })} comes before ${cause.command} and is neither a package runner nor a NAME=value setting, ${UNJUDGED_OPTION}`,
        fix: `put only package runners and NAME=value settings before ${cause.command}`,
      };
    case "unreadable":
      return {
        problem: `a quote in the script has no partner, so Hone cannot read what the script passes to ${cause.command} or tell what that does to the files under check`,
        fix: "pair every quote in the script",
      };
  }
};
