import { expect, it } from "vitest";

import { classDisposition, containerMode } from "./class-authoring.ts";

it("runtime class declarations are reported", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

it("class expressions stay runtime syntax", () => {
  expect(
    classDisposition({
      filename: "src/runtime.ts",
      kind: "expression",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("report");
});

it("ambient class declarations are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "ambient",
      container: "runtime",
    }),
  ).toBe("allow");
});

it("declaration files are type-only", () => {
  expect(
    classDisposition({
      filename: "src/external.d.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "runtime",
    }),
  ).toBe("allow");
});

it("classes enclosed by ambient modules are type-only", () => {
  expect(
    classDisposition({
      filename: "src/ambient.ts",
      kind: "declaration",
      declaration: "runtime",
      container: "ambient",
    }),
  ).toBe("allow");
});

it("the parent walk reaches an ambient module through an ordinary ancestor", () => {
  expect(
    containerMode({
      node: {
        type: "ClassBody",
        parent: { type: "TSModuleDeclaration", declare: true, parent: null },
      },
    }),
  ).toBe("ambient");
});

it("runtime namespaces do not provide an ambient exemption", () => {
  expect(containerMode({ node: { type: "TSModuleDeclaration", parent: null } })).toBe("runtime");
});

it("an unrelated declared node does not provide an ambient exemption", () => {
  expect(
    containerMode({
      node: { type: "VariableDeclaration", declare: true, parent: null },
    }),
  ).toBe("runtime");
});
