import type { EngineBindings } from "../../../src/domain/language-layer/catalogue-binding.ts";
import {
  type AddressedCheck,
  checkAddressTextOf,
} from "../../../src/domain/language-layer/check-address-text.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";
import {
  blocksOf,
  type CataloguePage,
  type FactLabel,
  factLines,
  itemPaths,
  type PageSource,
  pageOf,
  proseAt,
} from "./catalogue-page.ts";

const PAGE = "typescript/checks.md";

type Symptom = CatalogueFile["symptoms"][number];

type Check = CatalogueFile["checks"][number];

export type ChecksSource = PageSource & { readonly bindings: EngineBindings };

const MARGIN_LABELS: readonly FactLabel<
  "engines" | "flagsBeyondTheSymptom" | "misses" | "settingsTracedTo"
>[] = [
  { key: "engines", label: "Engines" },
  { key: "flagsBeyondTheSymptom", label: "Flags beyond the symptom" },
  { key: "misses", label: "Misses" },
  { key: "settingsTracedTo", label: "Settings traced to" },
];

export const addressedCheckOf = (check: Check): AddressedCheck => ({
  name: check.name,
  symptom: { name: check.symptom },
});

const enginesOf = (request: ChecksSource & { readonly check: Check }): string | undefined => {
  const address = checkAddressTextOf({ check: addressedCheckOf(request.check) });
  const engines = request.bindings.get(address) ?? [];
  return engines.length === 0 ? undefined : engines.map(({ name }) => `\`${name}\``).join(", ");
};

const marginLinesOf = (request: ChecksSource & { readonly check: Check }): string =>
  factLines({ facts: { ...request.check, engines: enginesOf(request) }, labels: MARGIN_LABELS });

const checkBlockOf = (request: ChecksSource & { readonly check: Check }): string =>
  blocksOf({
    blocks: [
      `### ${request.check.name}`,
      marginLinesOf(request),
      proseAt({
        path: request.path,
        prose: request.prose,
        itemPath: itemPaths.check(request.check),
        pagePath: PAGE,
      }),
    ],
  });

const symptomBlockOf = (request: ChecksSource & { readonly symptom: Symptom }): string => {
  const checks = request.file.checks.filter((check) => check.symptom === request.symptom.name);
  return checks.length === 0
    ? ""
    : blocksOf({
        blocks: [
          `## ${request.symptom.title}`,
          ...checks.map((check) => checkBlockOf({ ...request, check })),
        ],
      });
};

export const checksPageOf = (request: ChecksSource): CataloguePage =>
  pageOf({
    path: `rules/${PAGE}`,
    blocks: [
      "# Checks in TypeScript",
      ...request.file.symptoms.map((symptom) => symptomBlockOf({ ...request, symptom })),
    ],
  });
