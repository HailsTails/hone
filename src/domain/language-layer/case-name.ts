const TITLE_PARENTHETICAL = /\s*\([^)]*\)/g;

const NOT_A_NAME_CHARACTER = /[^a-z0-9]+/g;

const EDGE_HYPHEN = /^-|-$/g;

export const mapTitleToCaseName = (request: { readonly title: string }): string =>
  request.title
    .replace(TITLE_PARENTHETICAL, "")
    .toLowerCase()
    .replace(NOT_A_NAME_CHARACTER, "-")
    .replace(EDGE_HYPHEN, "");

export const findCaseNameFaults = (request: {
  readonly name: string;
  readonly title: string;
}): readonly string[] => {
  const titled = mapTitleToCaseName(request);
  return request.name === titled
    ? []
    : [`cases names ${request.name}, which its title ${request.title} names ${titled}`];
};
