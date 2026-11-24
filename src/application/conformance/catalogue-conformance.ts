import { gatheredOutcomes } from "../../domain/gathered-outcomes.ts";
import {
  type AddressedCheck,
  checkAddressTextOf,
} from "../../domain/language-layer/check-address-text.ts";
import type { Engine } from "../../domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../domain/result.ts";
import type { NamedConformancePort } from "../ports/engine/engine-port.ts";
import type { RunnerLocation } from "../ports/engine/runner-location.ts";
import type { PathPort } from "../ports/host/path-port.ts";
import type { LoadFailureDetail } from "../ports/report/load-failure-detail.ts";
import type { NamedCheckExamplesRepository } from "../ports/rule-set/named-check-examples.ts";
import { checkConformanceOf } from "./check-conformance.ts";
import type {
  CheckConformanceFailure,
  CheckRequest,
  ConformanceSetupFailure,
} from "./conformance-testing-types.ts";

export type CataloguedCheck = AddressedCheck & { readonly engines: readonly Engine[] };

export type CatalogueConformanceRequest = Omit<CheckRequest, "check"> &
  Omit<RunnerLocation, "mechanism" | "path"> & {
    readonly checks: readonly CataloguedCheck[];
    readonly path: Pick<PathPort, "join" | "resolve">;
    readonly examples: NamedCheckExamplesRepository;
    readonly loadFailureDetail: LoadFailureDetail;
    readonly enginePort: NamedConformancePort;
  };

export const catalogueConformanceOf = async (
  request: CatalogueConformanceRequest,
): Promise<Result<readonly CheckConformanceFailure[], ConformanceSetupFailure>> =>
  gatheredOutcomes({
    outcomes: await Promise.all(
      request.checks
        .filter(({ engines }) => engines.some(({ name }) => name === request.engine))
        .map((check) => checkConformanceOf({ ...request, check: checkAddressTextOf({ check }) })),
    ),
  });
