import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { RuleSetFiles } from "../../../application/ports/rule-set/rule-set-files.ts";
import { readHeldDiscipline } from "./held-discipline.ts";
import { readLocatedPieceFile } from "./located-piece-file.ts";

export const createRuleSetFileReader = (options: { readonly fileText: FileTextPort; readonly path: PathPort }): RuleSetFiles => ({
  disciplineFile: (request) => readHeldDiscipline({ ...options, ...request }),
  pieceFile: (request) => readLocatedPieceFile({ ...options, ...request }),
});