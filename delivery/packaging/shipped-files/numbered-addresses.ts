export type ShippedPage = { readonly path: string; readonly text: string };

type Span = { readonly start: number; readonly end: number };

type NumberPlace = "clause-address-in-code" | "pinned-page-in-code" | "lower-case-name-in-code" | "address";

const PAGE_SUFFIX = ".md";

const NUMBER = /\bcd[- ]?\d+[a-z]?(?:#[a-z0-9-]+)?/gi;

const LOWER_CASE_NUMBER = /^cd/;

const CODE = /```[\s\S]*?```|`[^`\n]+`/g;

const CLAUSE_SEPARATOR = "#";

const NUMBERED_PAGE_PATH = /rules\/CD-\d+[a-z]?\/[A-Z]+\.md/g;

const codeSpansOf = (request: { readonly text: string }): readonly Span[] =>
  [...request.text.matchAll(CODE)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

type Placement = "inside" | "outside";

const placementIn = (request: { readonly at: number; readonly spans: readonly Span[] }): Placement =>
  request.spans.some((span) => span.start <= request.at && request.at < span.end) ? "inside" : "outside";

const pinnedPagePathsOf = (request: { readonly text: string; readonly pinned: readonly string[] }): readonly Span[] =>
  [...request.text.matchAll(NUMBERED_PAGE_PATH)]
    .filter((match) => request.pinned.includes(match[0]))
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));

type PageSpans = { readonly code: readonly Span[]; readonly pinnedPaths: readonly Span[] };

const placeOf = (request: { readonly found: string; readonly at: number; readonly spans: PageSpans }): NumberPlace => {
  if (placementIn({ at: request.at, spans: request.spans.code }) === "outside") {
    return "address";
  }
  if (request.found.includes(CLAUSE_SEPARATOR)) {
    return "clause-address-in-code";
  }
  if (LOWER_CASE_NUMBER.test(request.found)) {
    return "lower-case-name-in-code";
  }
  return placementIn({ at: request.at, spans: request.spans.pinnedPaths }) === "inside" ? "pinned-page-in-code" : "address";
};

const lineOf = (request: { readonly text: string; readonly at: number }): number => request.text.slice(0, request.at).split("\n").length;

const numberedAddressesOnPage = (request: { readonly page: ShippedPage; readonly pinned: readonly string[] }): readonly string[] => {
  const spans = { code: codeSpansOf({ text: request.page.text }), pinnedPaths: pinnedPagePathsOf({ text: request.page.text, pinned: request.pinned }) };
  return [...request.page.text.matchAll(NUMBER)]
    .filter((match) => placeOf({ found: match[0], at: match.index, spans }) === "address")
    .map((match) => `${request.page.path}:${lineOf({ text: request.page.text, at: match.index })} names ${match[0]}`);
};

const pinnedProblemOf = (request: { readonly path: string; readonly pages: readonly ShippedPage[] }): readonly string[] => {
  const page = request.pages.find((candidate) => candidate.path === request.path);
  if (page === undefined) {
    return [`${request.path} is pinned but not shipped; take it off the list`];
  }
  return [...page.text.matchAll(NUMBER)].length === 0 ? [`${request.path} is pinned but gives no number; take it off the list`] : [];
};

export const numberedAddressesOf = (request: { readonly pages: readonly ShippedPage[]; readonly pinned: readonly string[] }): readonly string[] => {
  const pages = request.pages.filter((page) => page.path.endsWith(PAGE_SUFFIX));
  return [
    ...pages.filter((page) => !request.pinned.includes(page.path)).flatMap((page) => numberedAddressesOnPage({ page, pinned: request.pinned })),
    ...request.pinned.flatMap((path) => pinnedProblemOf({ path, pages })),
  ];
};
