import type { LoadFailure } from "../../../domain/report/load-failure.ts";

export type LoadFailureDetail = (request: { readonly failure: LoadFailure }) => string;
