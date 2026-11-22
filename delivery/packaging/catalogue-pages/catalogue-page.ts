import type { PathPort } from "../../../src/application/ports/host/path-port.ts";
import { gatheredOutcomes, listedOutcome } from "../../../src/domain/gathered-outcomes.ts";
import type { Result } from "../../../src/domain/result.ts";
import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";

export type CataloguePage = { readonly path: string; readonly text: string };

export type ItemProse = ReadonlyMap<string, string>;

export type Rendered<Value> = Result<Value, string>;

export type PageSource = { readonly file: CatalogueFile; readonly prose: ItemProse; readonly path: ItemPathPort };

export type Pointed = CatalogueFile["cases"][number]["owes"][number];

export const anchorOf = (request: { readonly title: string }): string =>
  request.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");

export const itemPaths = {
  principle: (request: { readonly name: string }): string => `principles/${request.name}.md`,
  rule: (request: { readonly name: string }): string => `rules/${request.name}.md`,
  case: (request: { readonly name: string }): string => `cases/${request.name}.md`,
  recipe: (request: { readonly name: string }): string => `typescript/recipes/${request.name}.md`,
  symptom: (request: { readonly name: string }): string => `typescript/symptoms/${request.name}.md`,
  check: (request: { readonly symptom: string; readonly name: string }): string => `typescript/symptoms/${request.symptom}/${request.name}.md`,
};

const MARKDOWN_LINK = /\]\((?<target>[^)#:]+)(?<anchor>#[^)]*)?\)/g;

const ONE_LINK = new RegExp(`^${MARKDOWN_LINK.source}$`);

export type ItemPathPort = Pick<PathPort, "joinRepository" | "repositoryDirectoryOf" | "relative">;

type Rebasing = { readonly path: ItemPathPort; readonly itemPath: string; readonly pagePath: string };

const rebasedLink = (request: Rebasing & { readonly link: string }): string => {
  const parts = ONE_LINK.exec(request.link)?.groups;
  if (parts?.target === undefined) {
    return request.link;
  }
  const target = request.path.joinRepository({ segments: [request.path.repositoryDirectoryOf({ path: request.itemPath }), parts.target] });
  const location = request.path.relative({ from: request.path.repositoryDirectoryOf({ path: request.pagePath }), to: target });
  return location.relation === "within-root" ? `](${location.path}${parts.anchor ?? ""})` : request.link;
};

export const rebasedProse = (request: Rebasing & { readonly prose: string }): string =>
  request.prose.replace(MARKDOWN_LINK, (link) => rebasedLink({ ...request, link }));

export const proseAt = (request: { readonly path: ItemPathPort; readonly prose: ItemProse; readonly itemPath: string; readonly pagePath: string }): string =>
  rebasedProse({ path: request.path, prose: request.prose.get(request.itemPath) ?? "", itemPath: request.itemPath, pagePath: request.pagePath });

export const blocksOf = (request: { readonly blocks: readonly string[] }): string => request.blocks.filter((block) => block.length > 0).join("\n\n");

export const pageOf = (request: { readonly path: string; readonly blocks: readonly string[] }): CataloguePage => ({
  path: request.path,
  text: `${blocksOf({ blocks: request.blocks })}\n`,
});

export const everyRendered = <Entry, Value>(request: { readonly entries: readonly Entry[]; readonly render: (entry: Entry) => Rendered<Value> }): Rendered<readonly Value[]> =>
  gatheredOutcomes({ outcomes: request.entries.map((entry) => listedOutcome({ outcome: request.render(entry) })) });

export const namedEntryOf = <Entry extends { readonly name: string }>(request: {
  readonly entries: readonly Entry[];
  readonly name: string;
  readonly listing: string;
}): Rendered<Entry> => {
  const entry = request.entries.find((each) => each.name === request.name);
  return entry === undefined ? { outcome: "failed", error: `the ${request.listing} hold no ${request.name}` } : { outcome: "ok", value: entry };
};

const pointedEntryOf = (request: { readonly file: CatalogueFile; readonly point: Pointed }): Rendered<{ readonly title: string; readonly principle: string }> => {
  const { point, file } = request;
  if ("rule" in point) {
    return namedEntryOf({ entries: file.rules, name: point.rule, listing: "rules" });
  }
  const principle = namedEntryOf({ entries: file.principles, name: point.principle, listing: "principles" });
  return principle.outcome === "failed" ? principle : { outcome: "ok", value: { title: principle.value.title, principle: principle.value.name } };
};

export const pointedTitleOf = (request: { readonly file: CatalogueFile; readonly point: Pointed }): Rendered<string> => {
  const entry = pointedEntryOf(request);
  return entry.outcome === "failed" ? entry : { outcome: "ok", value: entry.value.title };
};

export const principleOfPointed = (request: { readonly file: CatalogueFile; readonly point: Pointed }): Rendered<string> => {
  const entry = pointedEntryOf(request);
  return entry.outcome === "failed" ? entry : { outcome: "ok", value: entry.value.principle };
};
