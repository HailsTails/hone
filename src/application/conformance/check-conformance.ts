import { gatheredOutcomes } from "../../domain/gathered-outcomes.ts";
import { checkNamesOf } from "../../domain/language-layer/check-address-text.ts";
import { isRepoPath } from "../../domain/repository/repo-path.ts";
import type { Result } from "../../domain/result.ts";
import type { CheckBinding } from "../../domain/runner/check-binding.ts";
import { casesByEdition } from "../../domain/runner/edition-runs.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { NamedConformancePort } from "../ports/engine/engine-port.ts";
import type { RunnerLocation } from "../ports/engine/runner-location.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type {
  NamedCheckExamples,
  NamedCheckExamplesRepository,
} from "../ports/rule-set/named-check-examples.ts";
import type { RepoPathOf } from "./conformance-testing-types.ts";
import type {
  CheckConformanceFailure,
  CheckRequest,
  CheckUnderTest,
  ConformanceSetupFailure,
} from "./conformance-testing-types.ts";

type ExamplesRequest = CheckRequest & {
  readonly installRoot: RunnerLocation["installRoot"];
  readonly examples: NamedCheckExamplesRepository;
  readonly loadFailureDetail: LoadFailureDetail;
};

const examplesOf = (
  request: ExamplesRequest,
): Result<NamedCheckExamples, ConformanceSetupFailure> => {
  if (checkNamesOf({ text: request.check }) === undefined) {
    return { outcome: "failed", error: { kind: "address-invalid", detail: request.check } };
  }
  const read = request.examples.read(request);
  if (read.outcome === "ok") return read;
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
  const { check, engine } = request;
  const { piece, examples } = read.value;
  return {
    outcome: "ok",
    value: {
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
    Omit<RunnerLocation, "mechanism"> & { readonly enginePort: NamedConformancePort },
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
  const { piece, examples } = read.value;
  const binding: CheckBinding = {
    address: request.check,
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
