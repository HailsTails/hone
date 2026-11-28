import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { RecordKind } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import { ruleSetRootOf } from "../../hone-config-file/rule-set-root.ts";
import {
  type TeamRuleSet,
  usedTeamRuleSetsOf,
} from "../../upgrade/team-layout/version-one-team-layout.ts";
import { readBoundCatalogue } from "./bound-catalogue.ts";

type Sources = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly selection: ConsumerSelectionFile;
  readonly toolRecordKinds: readonly RecordKind[];
};

const catalogueAt = (
  request: Sources & { readonly ruleSet: TeamRuleSet },
): Result<readonly RuleSetCatalogue[], LoadFailure> => {
  const ruleSet = { name: request.ruleSet.name };
  const root = ruleSetRootOf({ ...request, ruleSet, ruleSets: [request.ruleSet] });
  if (root.outcome === "failed") return root;
  const held = readBoundCatalogue({
    ...request,
    ruleSet,
    ruleSetRoot: root.value,
    inheritedRecordKinds: request.toolRecordKinds,
  });
  if (held.outcome === "failed") return held;
  return {
    outcome: "ok",
    value: held.value.held === "catalogue" ? [{ ruleSet, catalogue: held.value.catalogue }] : [],
  };
};

export const upgradeRuleSetCataloguesOf = (
  request: Sources,
): Result<readonly RuleSetCatalogue[], LoadFailure> => {
  const read = everyOk({
    entries: usedTeamRuleSetsOf(request.selection),
    resolve: (ruleSet) => catalogueAt({ ...request, ruleSet }),
  });
  return read.outcome === "failed" ? read : { outcome: "ok", value: read.value.flat() };
};
