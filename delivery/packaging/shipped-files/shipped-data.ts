const SHIPPED_DATA: readonly RegExp[] = [
  /^rules\/[^/]+\/discipline\.json$/,
  /^src\/infrastructure\/disciplines-file\/version-one-names\.json$/,
  /^rules\/.+\.md$/,
  /^methods\/.+\.md$/,
  /^src\/infrastructure\/engines\/.+\.md$/,
  /^src\/infrastructure\/engines\/[^/]+\/[^/]+\/[^/]+\.cases\.json$/,
];

export type DataShipping = "shipped" | "not-shipped";

export const dataShippingOf = (request: { readonly path: string }): DataShipping =>
  SHIPPED_DATA.some((pattern) => pattern.test(request.path)) ? "shipped" : "not-shipped";
