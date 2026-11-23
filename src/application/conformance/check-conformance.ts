import { gatheredOutcomes } from "../../domain/gathered-outcomes.ts";
import { checkNamesOf } from "../../domain/language-layer/check-address-text.ts";
import type { AbsolutePath } from "../../domain/repository/absolute-path-types.ts";
import { isRepoPath } from "../../domain/repository/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { RuleSetIdentity } from "../../domain/rule-set/clause-address-types.ts";
import { TOOL_RULE_SET } from "../../domain/rule-set/clause-address.ts";
import { teamRuleSetOf } from "../../domain/rule-set/rule-set-identity.ts";
import type { CheckBinding } from "../../domain/runner/check-binding.ts";
import { casesByEdition } from "../../domain/runner/edition-runs.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { NamedConformancePort } from "../ports/engine/engine-port.ts";
import type { RunnerLocation } from "../ports/engine/runner-location.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type {
  NamedCheckExamples,
  NamedCheckExamplesRepository,
} from "../ports/rule-set/named-check-examples.ts";
import type {
  CheckConformanceFailure,
  CheckRequest,
  CheckUnderTest,
  ConformanceSetupFailure,
  RepoPathOf,
  TeamRuleSetUnderTest,
} from "./conformance-testing-types.ts";

type ExamplesRequest = CheckRequest & {
  readonly installRoot: RunnerLocation["installRoot"];
  readonly path: Pick<PathPort, "resolve">;
  readonly examples: NamedCheckExamplesRepository;
  readonly loadFailureDetail: LoadFailureDetail;
};

type PlacedRuleSet = { readonly identity: RuleSetIdentity; readonly root: AbsolutePath };

type ExamplesRead = NamedCheckExamples & { readonly ruleSet: RuleSetIdentity };

const ruleSetInvalid = (request: {
  readonly detail: string;
}): Result<never, ConformanceSetupFailure> => ({
  outcome: "failed",
  error: { kind: "rule-set-invalid", detail: request.detail },
});

const placedTeamRuleSet = (request: {
  readonly ruleSet: TeamRuleSetUnderTest;
  readonly path: Pick<PathPort, "resolve">;
}): Result<PlacedRuleSet, ConformanceSetupFailure> => {
  const { name, root } = request.ruleSet;
  const identity = teamRuleSetOf({ name });
  if (identity === undefined) {
    return ruleSetInvalid({
      detail: `${name} is not a team rule set name: use lower-case letters, digits and hyphens, and not ${TOOL_RULE_SET}`,
    });
  }
  const resolved = request.path.resolve({ path: root });
  return resolved.outcome === "failed"
    ? ruleSetInvalid({
        detail: `the root ${root} of rule set ${name} does not resolve: ${resolved.error.kind}`,
      })
    : { outcome: "ok", value: { identity, root: resolved.value } };
};

const placedRuleSet = (request: ExamplesRequest): Result<PlacedRuleSet, ConformanceSetupFailure> =>
  request.ruleSet === TOOL_RULE_SET
    ? { outcome: "ok", value: { identity: TOOL_RULE_SET, root: request.installRoot } }
    : placedTeamRuleSet({ ruleSet: request.ruleSet, path: request.path });

const examplesOf = (request: ExamplesRequest): Result<ExamplesRead, ConformanceSetupFailure> => {
  if (checkNamesOf({ text: request.check }) === undefined) {
    return { outcome: "failed", error: { kind: "address-invalid", detail: request.check } };
  }
  const placed = placedRuleSet(request);
  if (placed.outcome === "failed") return placed;
  const read = request.examples.read({
    installRoot: request.installRoot,
    ruleSetRoot: placed.value.root,
    check: request.check,
    engine: request.engine,
  });
  if (read.outcome === "ok") {
    return { outcome: "ok", value: { ...read.value, ruleSet: placed.value.identity } };
  }
  return {
    outcome: "failed",
    error: {
      kind: read.error.kind === "piece-missing" ? "check-missing" : "rule-set-unloadable",
      detail: request.loadFailureDetail({ failure: read.error }),
    },
  };
};

export const checkUnderTestOf = (
  request: ExamplesRequest,
): Result<CheckUnderTest, ConformanceSetupFailure> => {
  const read = examplesOf(request);
  if (read.outcome === "failed") {
    return read;
  }
  const { ruleSet, check, engine } = request;
  const { piece, examples } = read.value;
  return {
    outcome: "ok",
    value: {
      ruleSet,
      check,
      engine,
      examples: examples.map((example) => ({
        name: example.name,
        file: example.fileName,
        source: example.source,
        edition: example.edition ?? piece.editions.default,
      })),
    },
  };
};

export const checkConformanceOf = async (
  request: ExamplesRequest &
    Omit<RunnerLocation, "mechanism" | "path"> & {
      readonly path: Pick<PathPort, "join" | "resolve">;
      readonly enginePort: NamedConformancePort;
    },
): Promise<Result<readonly CheckConformanceFailure[], ConformanceSetupFailure>> => {
  const read = examplesOf(request);
  if (read.outcome === "failed") return read;

  const mechanism = request.engine;
  const runner = await request.enginePort.load({ ...request, mechanism });
  if (runner.outcome === "failed") {
    return {
      outcome: "failed",
      error: {
        kind: "runner-unloadable",
        detail: request.loadFailureDetail({ failure: runner.error }),
      },
    };
  }
  const { piece, examples, ruleSet } = read.value;
  const binding: CheckBinding = {
    address: request.check,
    ruleSet,
    engine: mechanism,
    anchor: piece.anchor,
    pieceRoot: piece.pieceRoot,
    settings: piece.settings,
    forms: piece.forms,
    checkSettings: defaultClauseSettings({ declarations: piece.declarations }),
    edition: piece.editions.default,
  };
  const conformed = gatheredOutcomes({
    outcomes: await Promise.all(
      casesByEdition({ cases: examples, defaultEdition: binding.edition }).map(
        ({ edition, cases }) =>
          request.enginePort.conform({
            binding: { ...binding, edition },
            cases,
            runner: runner.value,
          }),
      ),
    ),
  });
  return conformed.outcome === "ok"
    ? conformed
    : {
        outcome: "failed",
        error: {
          kind: "runner-refused",
          detail: request.loadFailureDetail({
            failure: { kind: "runner-failed", mechanism, failure: conformed.error },
          }),
        },
      };
};

export const repoPathOf: RepoPathOf = ({ file }) =>
  isRepoPath(file)
    ? { outcome: "ok", value: file }
    : { outcome: "failed", error: { kind: "file-invalid", detail: file } };
