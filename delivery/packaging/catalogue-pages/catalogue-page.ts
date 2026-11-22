import type { CatalogueFile } from "../../../src/infrastructure/content-files/symptom-catalogues/symptom-catalogue-wire.ts";

export type CataloguePage = { readonly path: string; readonly text: string };

export type ItemProse = ReadonlyMap<string, string>;

export type PageSource = { readonly file: CatalogueFile; readonly prose: ItemProse };

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

const foldersOf = (request: { readonly path: string }): readonly string[] => request.path.split("/").slice(0, -1);

const PARENT = "..";

const climbsOf = (request: { readonly parts: readonly string[] }): number => {
  const firstDown = request.parts.findIndex((part) => part !== PARENT);
  return firstDown === -1 ? request.parts.length : firstDown;
};

const resolvedSegments = (request: { readonly from: readonly string[]; readonly target: string }): readonly string[] => {
  const parts = request.target.split("/").filter((part) => part !== ".");
  const climbs = climbsOf({ parts });
  const above = Array.from({ length: Math.max(0, climbs - request.from.length) }, () => PARENT);
  return [...above, ...request.from.slice(0, Math.max(0, request.from.length - climbs)), ...parts.slice(climbs)];
};

const sharedDepth = (request: { readonly left: readonly string[]; readonly right: readonly string[] }): number => {
  const differing = request.left.findIndex((segment, index) => request.right[index] !== segment);
  return differing === -1 ? Math.min(request.left.length, request.right.length) : differing;
};

const relativeTarget = (request: { readonly folder: readonly string[]; readonly segments: readonly string[] }): string => {
  const shared = sharedDepth({ left: request.folder, right: request.segments.slice(0, -1) });
  return [...request.folder.slice(shared).map(() => ".."), ...request.segments.slice(shared)].join("/");
};

const ONE_LINK = new RegExp(`^${MARKDOWN_LINK.source}$`);

type Rebasing = { readonly itemPath: string; readonly pagePath: string };

const rebasedLink = (request: Rebasing & { readonly link: string }): string => {
  const parts = ONE_LINK.exec(request.link)?.groups;
  if (parts?.target === undefined) {
    return request.link;
  }
  const segments = resolvedSegments({ from: foldersOf({ path: request.itemPath }), target: parts.target });
  return `](${relativeTarget({ folder: foldersOf({ path: request.pagePath }), segments })}${parts.anchor ?? ""})`;
};

export const rebasedProse = (request: Rebasing & { readonly prose: string }): string =>
  request.prose.replace(MARKDOWN_LINK, (link) => rebasedLink({ itemPath: request.itemPath, pagePath: request.pagePath, link }));

export const proseAt = (request: { readonly prose: ItemProse; readonly path: string; readonly pagePath: string }): string =>
  rebasedProse({ prose: request.prose.get(request.path) ?? "", itemPath: request.path, pagePath: request.pagePath });

export const blocksOf = (request: { readonly blocks: readonly string[] }): string => request.blocks.filter((block) => block.length > 0).join("\n\n");

export const pageOf = (request: { readonly path: string; readonly blocks: readonly string[] }): CataloguePage => ({
  path: request.path,
  text: `${blocksOf({ blocks: request.blocks })}\n`,
});

export const pointedTitleOf = (request: { readonly file: CatalogueFile; readonly point: Pointed }): string => {
  const { point, file } = request;
  return "rule" in point
    ? (file.rules.find((rule) => rule.name === point.rule)?.title ?? point.rule)
    : (file.principles.find((principle) => principle.name === point.principle)?.title ?? point.principle);
};

export const principleOfPointed = (request: { readonly file: CatalogueFile; readonly point: Pointed }): string => {
  const { point, file } = request;
  return "rule" in point ? (file.rules.find((rule) => rule.name === point.rule)?.principle ?? point.rule) : point.principle;
};
