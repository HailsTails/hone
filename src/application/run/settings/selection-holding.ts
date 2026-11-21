import type { SelectionReading } from "../../../domain/settings/selection/selection.ts";
import type { SelectionRepository } from "../../ports/selection/selection-repository.ts";

export const selectionRepositoryHolding = (request: { readonly reading: SelectionReading }): SelectionRepository => ({
  read: (_request) => ({ outcome: "ok", value: request.reading }),
});
