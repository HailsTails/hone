import type { UpgradeRefusal } from "../../../domain/records/upgrade/upgrade-refusal.ts";
import { TOOL_IDENTITY } from "../../../domain/rule-set/tool-identity.ts";
import { symptomUnheldText } from "../symptoms/symptom-lines.ts";

export const UPGRADE_ISSUES_URL = `${TOOL_IDENTITY.repository}/issues`;

export const FAULT_IN_HONE = `This is a fault in hone, not in your repository. Report it at ${UPGRADE_ISSUES_URL}, with this output.`;

export const mapMappingRefusalToLine = (request: { readonly refusal: UpgradeRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "clause-without-check":
      return `${refusal.clause} has no version 2 check to run it, and version 2 does not carry the clauses of a version 1 team rule set. Remove it from disciplines.json to upgrade without it, or stay on version 1.`;
    case "no-engine-on-mechanism":
      return `${refusal.check} has no engine on the ${refusal.mechanism} mechanism. ${FAULT_IN_HONE}`;
    case "two-engines-on-mechanism":
      return `${refusal.check} could run on ${refusal.engines.join(" or ")} through the ${refusal.mechanism} mechanism; the upgrade cannot choose. ${FAULT_IN_HONE}`;
    case "records-name-refused":
      return `${refusal.name} is not a name version 2 can file records under. ${FAULT_IN_HONE}`;
    case "confined-packages-unreadable":
      return `confinedPackages for ${refusal.clause} in disciplines.json is not a list of package names. Correct it, then run the upgrade again.`;
    case "symptom-unheld":
      return `${symptomUnheldText({ failure: refusal })}. ${FAULT_IN_HONE}`;
  }
};
