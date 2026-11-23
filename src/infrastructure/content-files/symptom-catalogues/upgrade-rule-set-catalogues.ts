import type { DirectoryPort } from "../../../application/ports/file-system/directory-port.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { LoadFailure, VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import type { RuleSetCatalogue } from "../../../domain/settings/check-choices.ts";
import { everyOk } from "../../../domain/settings/every-ok.ts";
import type { ConsumerSelectionFile } from "../../../domain/settings/selection/selection-file.ts";
import {
  NO_VERSION_ONE_NAMES,
  readVersionOneNames,
  type VersionOneNames,
} from "../../disciplines-file/version-one-names.ts";
import { ruleSetRootOf } from "../../hone-config-file/rule-set-root.ts";
import { readBoundCatalogue } from "./bound-catalogue.ts";

type Sources = {
  readonly fileText: FileTextPort;
  readonly directory: DirectoryPort;
  readonly path: PathPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly selection: ConsumerSelectionFile;
};

const catalogueAt = (
  request: Sources & {
    readonly ruleSet: RuleSetCatalogue["ruleSet"];
  },
): Result<readonly RuleSetCatalogue[], LoadFailure> => {
  const root = ruleSetRootOf({
    ...request,
    ruleSets: request.selection.ruleSets.map(([name, location]) => ({ name, location })),
  });
  if (root.outcome === "failed") return root;
  const path = request.path.join({ segments: [root.value, "rules", "version-one-names.json"] });
  const names: Result<VersionOneNames, VersionTwoLoadFailure> =
    request.fileText.exists({ path }) === "present"
      ? readVersionOneNames({ fileText: request.fileText, path })
      : { outcome: "ok", value: NO_VERSION_ONE_NAMES };
  if (names.outcome === "failed") return names;
  const held = readBoundCatalogue({
    ...request,
    ruleSetRoot: root.value,
    upgradeNames: names.value,
  });
  if (held.outcome === "failed") return held;
  return {
    outcome: "ok",
    value:
      held.value.held === "catalogue"
        ? [{ ruleSet: request.ruleSet, catalogue: held.value.catalogue }]
        : [],
  };
};

export const upgradeRuleSetCataloguesOf = (
  request: Sources,
): Result<readonly RuleSetCatalogue[], LoadFailure> => {
  const used = new Set(
    request.selection.clauses.flatMap(([{ ruleSet }]) =>
      ruleSet === TOOL_RULE_SET ? [] : [ruleSet.name],
    ),
  );
  const read = everyOk({
    entries: [...used],
    resolve: (name) => catalogueAt({ ...request, ruleSet: { name } }),
  });
  return read.outcome === "failed" ? read : { outcome: "ok", value: read.value.flat() };
};
