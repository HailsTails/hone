import { isCatalogueName, type CatalogueName } from "./catalogue-name.ts";

export const CHECK_ADDRESS_SEPARATOR = "#";

export type CheckNames = { readonly symptom: CatalogueName; readonly check: CatalogueName };

export const checkNamesOf = (request: { readonly text: string }): CheckNames | undefined => {
  const [symptom, check, trailingSegment] = request.text.split(CHECK_ADDRESS_SEPARATOR);
  return trailingSegment === undefined && symptom !== undefined && check !== undefined && isCatalogueName(symptom) && isCatalogueName(check)
    ? { symptom, check }
    : undefined;
};

export type CheckAddressText = `${string}#${string}`;

export type AddressedCheck = { readonly name: string; readonly symptom: { readonly name: string } };

export const checkAddressTextOf = (request: { readonly check: AddressedCheck }): CheckAddressText =>
  `${request.check.symptom.name}${CHECK_ADDRESS_SEPARATOR}${request.check.name}`;
