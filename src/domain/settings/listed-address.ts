import { type CheckAddressText, isCheckAddressText } from "../language-layer/check-address-text.ts";
import type { ClauseAddress } from "../rule-set/clause-address-types.ts";
import {
  type OwnedName,
  ownedNameOf,
  ownedNameText,
  sameOwnedName,
} from "../rule-set/rule-set-identity.ts";

export type ListedAddress = {
  readonly ruleSet: ClauseAddress["ruleSet"];
  readonly check: CheckAddressText;
};

export const listedAddressOf = (request: { readonly text: string }): ListedAddress | undefined => {
  const owned = ownedNameOf({ text: request.text });
  return owned === "not-an-owned-name" || !isCheckAddressText(owned.name)
    ? undefined
    : { ruleSet: owned.ruleSet, check: owned.name };
};

const ownedNameOfAddress = (request: { readonly address: ListedAddress }): OwnedName => ({
  ruleSet: request.address.ruleSet,
  name: request.address.check,
});

export const listedAddressText = (request: { readonly address: ListedAddress }): string =>
  ownedNameText(ownedNameOfAddress(request));

export const sameListedAddress = (request: {
  readonly left: ListedAddress;
  readonly right: ListedAddress;
}): "same" | "different" =>
  sameOwnedName({
    left: ownedNameOfAddress({ address: request.left }),
    right: ownedNameOfAddress({ address: request.right }),
  });
