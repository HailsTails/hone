import type { EnginePort } from "../ports/engine/engine-port.ts";
import type { RunnerLocation } from "../ports/engine/runner-location.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { NamedCheckExamples, NamedCheckExamplesRepository } from "../ports/rule-set/named-check-examples.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { Result } from "../../domain/result.ts";
import type { CheckRequest, CheckUnderTest, ConformanceFailure, ConformanceSetupFailure } from "./conformance-testing-types.ts";
import { conformBoundClause } from "./clause-conformance.ts";

type ExamplesRequest = CheckRequest & {
  readonly installRoot: RunnerLocation["installRoot"];
  readonly examples: NamedCheckExamplesRepository;
  readonly loadFailureDetail: LoadFailureDetail;
};

const examplesOf = (request: ExamplesRequest): Result<NamedCheckExamples, ConformanceSetupFailure> => {
  const read = request.examples.read(request);
  return read.outcome === "failed"
    ? { outcome: "failed", error: { kind: "rule-set-unloadable", detail: request.loadFailureDetail({ failure: read.error }) } }
    : read;
};

export const checkUnderTestOf = (request: ExamplesRequest): Result<CheckUnderTest, ConformanceSetupFailure> => {
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

export const checkConformanceOf = (
  request: ExamplesRequest & Omit<RunnerLocation, "mechanism"> & { readonly enginePort: EnginePort },
): Promise<Result<readonly ConformanceFailure[], ConformanceSetupFailure>> => {
  const read = examplesOf(request);
  if (read.outcome === "failed") {
    return Promise.resolve(read);
  }
  const translated = request.examples.runnerAddress(request);
  if (translated.outcome === "failed") {
    return Promise.resolve({ outcome: "failed", error: { kind: "address-invalid", detail: request.loadFailureDetail({ failure: translated.error }) } });
  }
  const { piece, examples } = read.value;
  const clause = {
    address: translated.value,
    anchor: piece.anchor,
    pieceRoot: piece.pieceRoot,
    settings: piece.settings,
    clauseSettings: defaultClauseSettings({ declarations: piece.declarations }),
    edition: piece.editions.default,
  };
  const { installRoot, moduleExtension, modules, path, engine, enginePort, loadFailureDetail } = request;
  return conformBoundClause({
    location: { installRoot, moduleExtension, modules, path, mechanism: engine },
    engine: enginePort,
    loadFailureDetail,
    bound: { clause, cases: examples },
  });
};
