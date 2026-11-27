import type { CheckAddressText } from "../../domain/language-layer/check-address-text.ts";
import type { RuleSetIdentity } from "../../domain/rule-set/clause-address-types.ts";
import type { Edition } from "../../domain/rule-set/edition-types.ts";
import type { EngineId } from "../../domain/rule-set/identifier-types.ts";
import { bindCheck, type CheckBinding } from "../../domain/runner/check-binding.ts";
import { defaultClauseSettings } from "../../domain/settings/clause-settings/default-clause-settings.ts";
import type { CheckPiece } from "../ports/settings-sources.ts";

export const createCheckBinding = (request: {
  readonly check: CheckAddressText;
  readonly ruleSet: RuleSetIdentity;
  readonly engine: EngineId;
  readonly piece: CheckPiece;
  readonly edition: Edition;
}): CheckBinding => {
  const { check, ruleSet, engine, piece } = request;
  return bindCheck({
    address: check,
    ruleSet,
    engine,
    anchor: piece.anchor,
    pieceRoot: piece.pieceRoot,
    settings: piece.settings,
    forms: piece.forms,
    checkSettings: defaultClauseSettings({ declarations: piece.declarations }),
    edition: request.edition,
  });
};
