import type { FileTextPort } from "../../../src/application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import {
  type AddressedCheck,
  checkAddressOfNames,
  checkAddressTextOf,
  checkNamesOf,
} from "../../../src/domain/language-layer/check-address-text.ts";
import type { Check } from "../../../src/domain/language-layer/symptom-catalogue.ts";
import type { Result } from "../../../src/domain/result.ts";
import { TOOL_RULE_SET } from "../../../src/domain/rule-set/clause-address.ts";
import type { EngineId } from "../../../src/domain/rule-set/identifier-types.ts";
import type { CheckBinding } from "../../../src/domain/runner/check-binding.ts";
import { defaultClauseSettings } from "../../../src/domain/settings/clause-settings/default-clause-settings.ts";
import { everyOk } from "../../../src/domain/settings/every-ok.ts";
import { readNamedPiece } from "../../../src/infrastructure/engines/named-piece.ts";

export type RunCheck = AddressedCheck & Pick<Check, "engines">;

type BindingSource = {
  readonly repoRoot: string;
  readonly fileText: Pick<FileTextPort, "exists" | "read">;
  readonly path: Pick<PathPort, "join">;
};

type EditionBindings = Result<readonly CheckBinding[], string>;

const readEditionBindings = (
  request: BindingSource & { readonly check: RunCheck; readonly engine: EngineId },
): EditionBindings => {
  const address = checkAddressTextOf(request);
  const names = checkNamesOf({ text: address });
  if (names === undefined) {
    return { outcome: "failed", error: `${address} is not a check address` };
  }
  const held = readNamedPiece({
    ...request,
    ...names,
    installRoot: request.repoRoot,
    ruleSetRoot: request.repoRoot,
    mechanism: request.engine,
  });
  if (held.outcome === "failed") {
    return { outcome: "failed", error: `${address} on ${request.engine}: ${held.error.kind}` };
  }
  const { editions, settings, pieceRoot, anchor, declarations, forms } = held.value;
  return {
    outcome: "ok",
    value: editions.declared.map((edition) => ({
      address,
      ruleSet: TOOL_RULE_SET,
      engine: request.engine,
      edition,
      settings,
      pieceRoot,
      anchor,
      checkSettings: defaultClauseSettings({ declarations }),
      forms: Object.fromEntries(
        Object.entries(forms).map(([form, name]) => [form, checkAddressOfNames(name)]),
      ),
    })),
  };
};

export const readCheckBindings = (
  request: BindingSource & { readonly checks: readonly RunCheck[] },
): Result<readonly CheckBinding[], string> => {
  const bound = everyOk({
    entries: request.checks.flatMap((check) =>
      check.engines.map(({ name }) => ({ check, engine: name })),
    ),
    resolve: ({ check, engine }) => readEditionBindings({ ...request, check, engine }),
  });
  return bound.outcome === "failed" ? bound : { outcome: "ok", value: bound.value.flat() };
};
