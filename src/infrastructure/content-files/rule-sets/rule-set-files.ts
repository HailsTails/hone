import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import { pieceFilePath, readPieceFile } from "./rule-set-reader.ts";
import { readHeldDiscipline } from "./held-discipline.ts";
import type { Held } from "../../../application/ports/rule-set/rule-set-files.ts";
import type { DisciplineFile, PieceFile } from "../../../domain/rule-set/rule-set-types.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { DisciplineId, EngineId } from "../../../domain/rule-set/identifier-types.ts";
import { runnerModuleSegmentsOf } from "../../node/modules/install-layout.ts";
import type { ModuleExtension } from "../../../application/ports/host/module-extension.ts";
import type { Result } from "../../../domain/result.ts";
import type { AddressedCheck } from "../../../domain/language-layer/check-address-text.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import { readInstallChecks } from "./install-checks.ts";

export type RuleSetFiles = {
  readonly discipline: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly discipline: DisciplineId;
  }) => Result<Held<DisciplineFile>, LoadFailure>;
  readonly piece: (request: {
    readonly ruleSetRoot: AbsolutePath;
    readonly installRoot: AbsolutePath;
    readonly discipline: DisciplineFile;
    readonly mechanism: EngineId;
  }) => Result<Held<PieceFile>, LoadFailure>;
  readonly checks: (request: {
    readonly installRoot: AbsolutePath;
    readonly clause: ClauseAddress;
  }) => Result<readonly AddressedCheck[], LoadFailure>;
  readonly runner: (request: {
    readonly installRoot: AbsolutePath;
    readonly mechanism: EngineId;
    readonly moduleExtension: ModuleExtension;
  }) => "present" | "absent";
};

const heldOf = <File>(request: { readonly presence: "present" | "absent"; readonly read: () => Result<File, LoadFailure> }): Result<Held<File>, LoadFailure> => {
  if (request.presence === "absent") {
    return { outcome: "ok", value: { held: "absent" } };
  }
  const read = request.read();
  return read.outcome === "failed" ? read : { outcome: "ok", value: { held: "present", file: read.value } };
};

export const createRuleSetFiles = (options: { readonly fileText: FileTextPort; readonly path: PathPort }): RuleSetFiles => ({
  discipline: ({ ruleSetRoot, installRoot, discipline }) => readHeldDiscipline({ fileText: options.fileText, path: options.path, ruleSetRoot, installRoot, discipline }),
  piece: ({ ruleSetRoot, installRoot, discipline, mechanism }) => {
    const location = { path: options.path, ruleSetRoot, installRoot, discipline: discipline.id, mechanism };
    return heldOf({
      presence: options.fileText.exists({ path: pieceFilePath(location) }),
      read: () => readPieceFile({ ...location, fileText: options.fileText, discipline }),
    });
  },
  checks: ({ installRoot, clause }) =>
    clause.ruleSet === TOOL_RULE_SET
      ? readInstallChecks({ fileText: options.fileText, path: options.path, installRoot, clause })
      : { outcome: "ok", value: [] },
  runner: ({ installRoot, mechanism, moduleExtension }) =>
    options.fileText.exists({ path: options.path.join({ segments: runnerModuleSegmentsOf({ installRoot, mechanism, moduleExtension }) }) }),
});
