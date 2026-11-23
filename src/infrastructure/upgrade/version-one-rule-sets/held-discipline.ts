import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { Held } from "../../../application/ports/rule-set/rule-set-files.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { DisciplineId } from "../../../domain/rule-set/identifier-types.ts";
import type { DisciplineFile } from "../../../domain/rule-set/rule-set-types.ts";
import { readInstallDiscipline } from "../../content-files/rule-sets/install-discipline.ts";
import {
  disciplineFilePath,
  readDisciplineFile,
} from "../../content-files/rule-sets/rule-set-reader.ts";

type DisciplineRequest = {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly ruleSetRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
  readonly discipline: DisciplineId;
};

const readTeamDiscipline = (
  request: DisciplineRequest,
): Result<Held<DisciplineFile>, VersionTwoLoadFailure> => {
  const path = disciplineFilePath(request);
  if (request.fileText.exists({ path }) === "absent") {
    return { outcome: "ok", value: { held: "absent" } };
  }
  const read = readDisciplineFile({
    fileText: request.fileText,
    path,
    discipline: request.discipline,
  });
  return read.outcome === "failed"
    ? read
    : { outcome: "ok", value: { held: "present", file: read.value } };
};

export const readHeldDiscipline = (
  request: DisciplineRequest,
): Result<Held<DisciplineFile>, VersionTwoLoadFailure> =>
  request.ruleSetRoot === request.installRoot
    ? readInstallDiscipline(request)
    : readTeamDiscipline(request);
