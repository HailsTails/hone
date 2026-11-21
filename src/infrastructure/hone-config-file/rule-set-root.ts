import type { VersionTwoLoadFailure } from "../../domain/report/load-failure.ts";
import type { PathPort } from "../node/path-port.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import type { ClauseAddress } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import type { Result } from "../../domain/result.ts";
import type { DeclaredRuleSet } from "../../domain/settings/settings-file.ts";

export const ruleSetRootOf = (request: {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly ruleSets: readonly DeclaredRuleSet[];
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly path: Pick<PathPort, "join" | "resolve">;
}): Result<AbsolutePath, VersionTwoLoadFailure> => {
  const { ruleSet } = request;
  if (ruleSet === TOOL_RULE_SET) {
    return { outcome: "ok", value: request.installRoot };
  }
  const declared = request.ruleSets.find((candidate) => candidate.name === ruleSet.name);
  if (declared === undefined) {
    return { outcome: "failed", error: { kind: "unknown-rule-set", name: ruleSet.name } };
  }
  if (declared.location.location === "repo-root") {
    return { outcome: "ok", value: request.repoRoot };
  }
  const directory = request.path.join({ segments: [request.repoRoot, declared.location.path] });
  const resolved = request.path.resolve({ path: directory });
  return resolved.outcome === "failed"
    ? { outcome: "failed", error: { kind: "rule-set-invalid", path: directory, detail: `the directory of rule set ${ruleSet.name} resolves to no absolute path` } }
    : { outcome: "ok", value: resolved.value };
};
