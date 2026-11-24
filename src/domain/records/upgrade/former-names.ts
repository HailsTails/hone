import {
  CHECK_ADDRESS_SEPARATOR,
  type CheckAddressText,
  checkNamesOf,
} from "../../language-layer/check-address-text.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { listedAddressOf, listedAddressText } from "../../settings/listed-address.ts";
import type { NamedFolderKind } from "../hone-records/named-folder-kind.ts";
import { recordedReachOf } from "../hone-records/recorded-reach.ts";

type FormerName = { readonly former: string; readonly current: string };

const FORMER_SYMPTOMS: readonly FormerName[] = [
  { former: "assertion-outside-a-test", current: "assertion-outside-a-test-body" },
  { former: "code-or-prose-read-as-text", current: "code-or-prose-read-as-text-in-a-test" },
  { former: "export-from-a-test-file", current: "export-from-a-test" },
  { former: "port-outside-the-domain", current: "port-beside-its-adapter" },
];

const FORMER_RECIPES: readonly FormerName[] = [
  { former: "port-in-the-domain", current: "port-in-a-module-of-its-own" },
  { former: "bounded-context-generic", current: "constrained-context-generic" },
  { former: "stub-with-vifn", current: "stub-with-vi-fn" },
  { former: "iteach-over-typed-rows", current: "it-each-over-typed-rows" },
];

const mapNameToCurrent = (request: {
  readonly names: readonly FormerName[];
  readonly name: string;
}): string => request.names.find(({ former }) => former === request.name)?.current ?? request.name;

export const mapSymptomToCurrent = (request: { readonly name: string }): string =>
  mapNameToCurrent({ names: FORMER_SYMPTOMS, name: request.name });

export const mapRecipeToCurrent = (request: { readonly name: string }): string =>
  mapNameToCurrent({ names: FORMER_RECIPES, name: request.name });

export const mapRecordsFileNameToCurrent = (request: {
  readonly kind: NamedFolderKind;
  readonly name: string;
}): string => {
  switch (request.kind) {
    case "debt":
    case "authorised-locations":
      return mapSymptomToCurrent(request);
    case "deviations":
      return mapRecipeToCurrent(request);
  }
};

export const mapReachToCurrent = (request: { readonly text: string }): string => {
  const reach = recordedReachOf(request);
  if (reach === "not-a-recorded-reach") {
    return request.text;
  }
  const symptom = mapSymptomToCurrent({ name: reach.symptom });
  switch (reach.reaches) {
    case "whole-symptom":
      return symptom;
    case "one-check":
      return `${symptom}${CHECK_ADDRESS_SEPARATOR}${reach.check}`;
  }
};

const mapCheckAddressToCurrent = (request: {
  readonly check: CheckAddressText;
}): CheckAddressText => {
  const names = checkNamesOf({ text: request.check });
  return names === undefined
    ? request.check
    : `${mapSymptomToCurrent({ name: names.symptom })}${CHECK_ADDRESS_SEPARATOR}${names.check}`;
};

export const mapListedAddressToCurrent = (request: { readonly text: string }): string => {
  const address = listedAddressOf(request);
  if (address === undefined || address.ruleSet !== TOOL_RULE_SET) {
    return request.text;
  }
  const check = mapCheckAddressToCurrent({ check: address.check });
  return check === address.check
    ? request.text
    : listedAddressText({ address: { ...address, check } });
};
