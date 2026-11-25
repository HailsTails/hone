import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import {
  type AddressedCheck,
  checkAddressTextOf,
} from "../../../domain/language-layer/check-address-text.ts";
import type { VersionTwoLoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import type { Result } from "../../../domain/result.ts";
import type { ClauseAddress } from "../../../domain/rule-set/clause-address-types.ts";
import { sameClauseAddress, TOOL_RULE_SET } from "../../../domain/rule-set/clause-address.ts";
import {
  type NamedClause,
  readVersionOneNames,
  VERSION_ONE_NAMES_SEGMENTS,
} from "../../disciplines-file/version-one-names.ts";

const byAddress = (left: AddressedCheck, right: AddressedCheck): number =>
  checkAddressTextOf({ check: left }).localeCompare(checkAddressTextOf({ check: right }));

const checksNamedFor = (request: {
  readonly named: NamedClause;
  readonly clause: ClauseAddress;
}): readonly AddressedCheck[] =>
  request.named.kind === "mechanical" &&
  sameClauseAddress({ left: request.named.clause, right: request.clause }) === "same"
    ? request.named.checks
    : [];

export const readInstallChecks = (request: {
  readonly fileText: FileTextPort;
  readonly path: PathPort;
  readonly installRoot: AbsolutePath;
  readonly clause: ClauseAddress;
}): Result<readonly AddressedCheck[], VersionTwoLoadFailure> => {
  const names = readVersionOneNames({
    fileText: request.fileText,
    path: request.path.join({ segments: [request.installRoot, ...VERSION_ONE_NAMES_SEGMENTS] }),
    ruleSet: TOOL_RULE_SET,
  });
  return names.outcome === "failed"
    ? names
    : {
        outcome: "ok",
        value: names.value.namedClauses
          .flatMap((named) => checksNamedFor({ named, clause: request.clause }))
          .toSorted(byAddress),
      };
};
