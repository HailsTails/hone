import { CATALOGUE_NAME } from "../../language-layer/catalogue-name.ts";
import { CHECK_ADDRESS_SEPARATOR } from "../../language-layer/check-address-text.ts";

export type RecordedReach = { readonly reaches: "whole-symptom"; readonly symptom: string } | { readonly reaches: "one-check"; readonly symptom: string; readonly check: string };

const RECORDED_REACH = new RegExp(`^${CATALOGUE_NAME}(?:${CHECK_ADDRESS_SEPARATOR}${CATALOGUE_NAME})?$`);

export const recordedReachOf = (request: { readonly text: string }): RecordedReach | "not-a-recorded-reach" => {
  if (!RECORDED_REACH.test(request.text)) {
    return "not-a-recorded-reach";
  }
  const mark = request.text.indexOf(CHECK_ADDRESS_SEPARATOR);
  return mark === -1
    ? { reaches: "whole-symptom", symptom: request.text }
    : { reaches: "one-check", symptom: request.text.slice(0, mark), check: request.text.slice(mark + 1) };
};
