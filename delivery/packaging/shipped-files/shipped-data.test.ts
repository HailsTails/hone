import { describe, expect, it } from "vitest";

import { type DataShipping, dataShippingOf } from "./shipped-data.ts";

type ShippingRow = { readonly path: string; readonly shipping: DataShipping };

describe("dataShippingOf", () => {
  it.each<ShippingRow>([
    { path: "rules/CD-14/discipline.json", shipping: "shipped" },
    { path: "src/infrastructure/disciplines-file/version-one-names.json", shipping: "shipped" },
    { path: "rules/typescript/symptoms/date-used-directly/clock-sources.md", shipping: "shipped" },
    { path: "rules/README.md", shipping: "shipped" },
    { path: "rules/CD-14/CHECKS.md", shipping: "shipped" },
    { path: "methods/lenses/naming.md", shipping: "shipped" },
    { path: "src/infrastructure/engines/eslint/CD-14/README.md", shipping: "shipped" },
    {
      path: "src/infrastructure/engines/walker/exported-for-test/export-test-sibling/export-test-sibling.examples.json",
      shipping: "shipped",
    },
    { path: "rules/CD-14/nested/discipline.json", shipping: "not-shipped" },
    {
      path: "src/infrastructure/engines/walker/exported-for-test/export-test-sibling/nested/export-test-sibling.examples.json",
      shipping: "not-shipped",
    },
    { path: "rules/typescript/symptoms.json", shipping: "not-shipped" },
    { path: "src/infrastructure/disciplines-file/selection-file.json", shipping: "not-shipped" },
    { path: "rules/CD-14/symptoms.json", shipping: "not-shipped" },
    {
      path: "src/infrastructure/engines/typescript-compiler/CD-14/piece.json",
      shipping: "not-shipped",
    },
    { path: "docs/output-contract.md", shipping: "not-shipped" },
    { path: "README.md", shipping: "not-shipped" },
  ])("$path is $shipping as data", ({ path, shipping }) => {
    expect(dataShippingOf({ path })).toBe(shipping);
  });
});
