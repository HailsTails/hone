import type { AttributedNativeException, Finding, GovernedRun } from "../../../infrastructure/command-line/governance.ts";
import type { NativeException } from "../../runner/runner-result-types.ts";
import type { TouchedSet } from "../../repository/touched-set.ts";
import { type ClauseAddress, clauseAddressText } from "../../../infrastructure/discipline-exceptions-folder/clause-address.ts";
import type { MechanismId } from "../../../infrastructure/hone-config-file/identifiers.ts";
import type { RepoPath } from "../../../infrastructure/hone-records-folder/repo-path.ts";
import type { ExceptionRecord } from "./exception-record.ts";

export type ExemptedFinding = {
  readonly finding: Finding;
  readonly by: readonly ExceptionRecord[];
};

export type DoublyHeld = {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
  readonly mechanism: MechanismId;
};

export type GovernanceRequest = {
  readonly findings: readonly Finding[];
  readonly records: readonly ExceptionRecord[];
  readonly touched: TouchedSet;
  readonly runs: readonly GovernedRun[];
};

export type GovernanceResult = {
  readonly findings: readonly Finding[];
  readonly exempted: readonly ExemptedFinding[];
  readonly stale: readonly ExceptionRecord[];
  readonly forfeited: readonly ExceptionRecord[];
  readonly doublyHeld: readonly DoublyHeld[];
  readonly unrecorded: readonly AttributedNativeException[];
};

const clauseKey = (request: { readonly clause: ClauseAddress }): string =>
  clauseAddressText({ address: request.clause });

const clauseFileKey = (request: {
  readonly clause: ClauseAddress;
  readonly file: RepoPath;
}): string => `${clauseKey({ clause: request.clause })} ${request.file}`;

const coverageKeyOf = (request: { readonly record: ExceptionRecord }): string => {
  switch (request.record.kind) {
    case "authorised-location":
    case "file-carve-out":
      return clauseFileKey({ clause: request.record.clause, file: request.record.file });
    case "clause-wide-carve-out":
      return clauseKey({ clause: request.record.clause });
  }
};

const nativeCoverageKeys = (request: {
  readonly exception: NativeException;
}): readonly string[] => {
  switch (request.exception.kind) {
    case "command-line-option":
      return [];
    case "inline-disable":
      return [clauseFileKey({ clause: request.exception.clause, file: request.exception.file })];
    case "ignore":
    case "config-override":
    case "suppression-entry":
    case "inline-rule-config":
      return [
        clauseKey({ clause: request.exception.clause }),
        clauseFileKey({ clause: request.exception.clause, file: request.exception.file }),
      ];
  }
};

const forfeitedRecords = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly touched: TouchedSet;
}): readonly ExceptionRecord[] => {
  switch (request.touched.measured) {
    case "no":
    case "elsewhere":
      return [];
    case "yes": {
      const touchedPaths = request.touched.paths;
      return request.records.filter(
        (record) => record.kind === "file-carve-out" && touchedPaths.has(record.file),
      );
    }
  }
};

const doublyHeldPairs = (request: {
  readonly inForce: readonly ExceptionRecord[];
}): readonly DoublyHeld[] => {
  const carvedKeys = new Set(
    request.inForce.flatMap((record) =>
      record.kind === "file-carve-out" ? [coverageKeyOf({ record })] : [],
    ),
  );
  return request.inForce.flatMap((record) =>
    record.kind === "authorised-location" && carvedKeys.has(coverageKeyOf({ record }))
      ? [{ clause: record.clause, file: record.file, mechanism: record.mechanism }]
      : [],
  );
};

const recordKeysOf = (request: {
  readonly records: readonly ExceptionRecord[];
  readonly mechanism: MechanismId;
}): ReadonlySet<string> =>
  new Set(
    request.records.flatMap((record) =>
      record.mechanism === request.mechanism ? [coverageKeyOf({ record })] : [],
    ),
  );

const coverageKeysIn = (request: {
  readonly run: GovernedRun;
  readonly exception: NativeException;
}): readonly string[] =>
  request.run.coverableKinds.includes(request.exception.kind) ? nativeCoverageKeys({ exception: request.exception }) : [];

const recordingOf = (request: {
  readonly run: GovernedRun;
  readonly recordKeys: ReadonlySet<string>;
  readonly exception: NativeException;
}): "recorded" | "unrecorded" =>
  coverageKeysIn(request).some((key) => request.recordKeys.has(key)) ? "recorded" : "unrecorded";

const unrecordedInRun = (request: {
  readonly run: GovernedRun;
  readonly records: readonly ExceptionRecord[];
}): readonly AttributedNativeException[] => {
  const recordKeys = recordKeysOf({ records: request.records, mechanism: request.run.mechanism });
  return request.run.nativeExceptions.flatMap((exception) =>
    recordingOf({ run: request.run, recordKeys, exception }) === "recorded"
      ? []
      : [{ ...exception, mechanism: request.run.mechanism }],
  );
};

const unrecordedExceptions = (request: {
  readonly runs: readonly GovernedRun[];
  readonly records: readonly ExceptionRecord[];
}): readonly AttributedNativeException[] =>
  request.runs.flatMap((run) => unrecordedInRun({ run, records: request.records }));

const exemptingRecords = (request: {
  readonly inForce: readonly ExceptionRecord[];
  readonly doublyHeld: readonly DoublyHeld[];
}): readonly ExceptionRecord[] => {
  const heldKeys = new Set(request.doublyHeld.map((pair) => clauseFileKey(pair)));
  return request.inForce.filter(
    (record) => record.kind === "clause-wide-carve-out" || !heldKeys.has(coverageKeyOf({ record })),
  );
};

const judgedFinding = (request: {
  readonly finding: Finding;
  readonly exempting: readonly ExceptionRecord[];
}): ExemptedFinding => {
  const findingKeys = [clauseKey(request.finding), clauseFileKey(request.finding)];
  return {
    finding: request.finding,
    by: request.exempting.filter((record) => findingKeys.includes(coverageKeyOf({ record }))),
  };
};

const recordsHoldingNative = (request: {
  readonly runs: readonly GovernedRun[];
  readonly exempting: readonly ExceptionRecord[];
}): readonly ExceptionRecord[] =>
  request.runs.flatMap((run) => {
    const coverageKeys = new Set(run.nativeExceptions.flatMap((exception) => coverageKeysIn({ run, exception })));
    return request.exempting.filter(
      (record) => record.mechanism === run.mechanism && coverageKeys.has(coverageKeyOf({ record })),
    );
  });

const governedFindings = (request: {
  readonly judged: readonly ExemptedFinding[];
  readonly exempting: readonly ExceptionRecord[];
  readonly runs: readonly GovernedRun[];
}): Pick<GovernanceResult, "findings" | "exempted" | "stale"> => {
  const credited = new Set([
    ...request.judged.flatMap((entry) => entry.by),
    ...recordsHoldingNative({ runs: request.runs, exempting: request.exempting }),
  ]);
  return {
    findings: request.judged.flatMap((entry) => (entry.by.length === 0 ? [entry.finding] : [])),
    exempted: request.judged.filter((entry) => entry.by.length > 0),
    stale: request.exempting.filter((record) => !credited.has(record)),
  };
};

export const applyGovernance = (request: GovernanceRequest): GovernanceResult => {
  const forfeited = forfeitedRecords({ records: request.records, touched: request.touched });
  const inForce = request.records.filter((record) => !forfeited.includes(record));
  const doublyHeld = doublyHeldPairs({ inForce });
  const exempting = exemptingRecords({ inForce, doublyHeld });
  const judged = request.findings.map((finding) => judgedFinding({ finding, exempting }));
  return {
    ...governedFindings({ judged, exempting, runs: request.runs }),
    forfeited,
    doublyHeld,
    unrecorded: unrecordedExceptions({ runs: request.runs, records: inForce }),
  };
};
