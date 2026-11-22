import type { FileTextPort } from "../../../application/ports/file-system/file-text-port.ts";
import type { PathPort } from "../../../application/ports/host/path-port.ts";
import type { BoundCatalogueOf } from "../../../application/ports/symptom-catalogue-repository.ts";
import type { CatalogueHolding } from "../../../domain/language-layer/symptom-catalogue.ts";
import type { LoadFailure } from "../../../domain/report/load-failure.ts";
import type { AbsolutePath } from "../../../domain/repository/absolute-path-types.ts";
import { type PackageLink, packageLinkOf } from "../../command-line/installation/package-link.ts";
import { shownFailureOf, shownPathOf } from "../../command-line/installation/shown-path.ts";
import { loadFailureDetail } from "../load-failures/load-failure-text.ts";
import { NO_SYMPTOM_GUIDE, type SymptomGuide } from "./symptom-notes.ts";

const SYMPTOM_PAGE_SEGMENTS: readonly string[] = ["rules", "typescript", "symptoms.md"];

export type GuideLocations = {
  readonly path: PathPort;
  readonly fileText: FileTextPort;
  readonly repoRoot: AbsolutePath;
  readonly installRoot: AbsolutePath;
};

export type SymptomGuideIn = (request: GuideLocations) => SymptomGuide;

type ShownGuideRequest = GuideLocations & { readonly link: PackageLink };

const symptomPageOf = (request: ShownGuideRequest): string =>
  shownPathOf({
    ...request,
    target: request.path.join({ segments: [request.installRoot, ...SYMPTOM_PAGE_SEGMENTS] }),
  });

const heldGuideOf = (
  request: ShownGuideRequest & { readonly holding: CatalogueHolding },
): SymptomGuide =>
  request.holding.held === "none"
    ? NO_SYMPTOM_GUIDE
    : { guide: "catalogue", catalogue: request.holding.catalogue, page: symptomPageOf(request) };

const unreadableGuideOf = (
  request: ShownGuideRequest & { readonly failure: LoadFailure },
): SymptomGuide => ({
  guide: "unreadable",
  failure: loadFailureDetail({ failure: shownFailureOf(request) }),
});

export const symptomGuideIn = (
  request: GuideLocations & { readonly boundCatalogueOf: BoundCatalogueOf },
): SymptomGuide => {
  const { path, fileText, repoRoot, installRoot } = request;
  const shown: ShownGuideRequest = {
    path,
    fileText,
    repoRoot,
    installRoot,
    link: packageLinkOf({ path, fileText, repoRoot, installRoot }),
  };
  const holding = request.boundCatalogueOf({
    fileText,
    path,
    ruleSetRoot: installRoot,
    installRoot,
  });
  return holding.outcome === "failed"
    ? unreadableGuideOf({ ...shown, failure: holding.error })
    : heldGuideOf({ ...shown, holding: holding.value });
};
