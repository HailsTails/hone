import type { ClauseAddress } from "../../../../../domain/rule-set/clause-address-types.ts";
import { TOOL_IDENTITY } from "../../../../../domain/rule-set/tool-identity.ts";

const NAMESPACE_SEPARATOR = "-";

type NamespaceClaim = "claimed" | "unclaimed";

const claimOf = (request: { readonly owner: string; readonly pluginNamespace: string }): NamespaceClaim =>
  request.pluginNamespace === request.owner ||
  request.pluginNamespace.startsWith(`${request.owner}${NAMESPACE_SEPARATOR}`)
    ? "claimed"
    : "unclaimed";

export const namespaceOwnershipRefusal = (request: {
  readonly address: ClauseAddress;
  readonly pluginNamespace: string;
}): string | undefined => {
  if (typeof request.address.ruleSet === "string") {
    return undefined;
  }
  const ruleSetName = request.address.ruleSet.name;
  const permitted = `${ruleSetName} or ${ruleSetName}${NAMESPACE_SEPARATOR}<name>`;
  if (claimOf({ owner: TOOL_IDENTITY.ownRuleSet, pluginNamespace: request.pluginNamespace }) === "claimed") {
    return `the plugin namespace ${request.pluginNamespace} belongs to ${TOOL_IDENTITY.name}; the rule set ${ruleSetName} must use ${permitted}`;
  }
  return claimOf({ owner: ruleSetName, pluginNamespace: request.pluginNamespace }) === "claimed"
    ? undefined
    : `the plugin namespace ${request.pluginNamespace} is not owned by the rule set ${ruleSetName}; use ${permitted}`;
};
