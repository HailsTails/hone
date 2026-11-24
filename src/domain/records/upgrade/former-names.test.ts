import { describe, expect, it } from "vitest";

import {
  mapRecordsFileNameToCurrent,
  mapListedAddressToCurrent,
  mapReachToCurrent,
} from "./former-names.ts";

describe("the current name of a records file's name", () => {
  it.each([
    { kind: "debt", name: "assertion-outside-a-test", current: "assertion-outside-a-test-body" },
    {
      kind: "authorised-locations",
      name: "code-or-prose-read-as-text",
      current: "code-or-prose-read-as-text-in-a-test",
    },
    { kind: "debt", name: "export-from-a-test-file", current: "export-from-a-test" },
    {
      kind: "authorised-locations",
      name: "port-outside-the-domain",
      current: "port-beside-its-adapter",
    },
    { kind: "deviations", name: "port-in-the-domain", current: "port-in-a-module-of-its-own" },
    {
      kind: "deviations",
      name: "bounded-context-generic",
      current: "constrained-context-generic",
    },
    { kind: "deviations", name: "stub-with-vifn", current: "stub-with-vi-fn" },
    { kind: "deviations", name: "iteach-over-typed-rows", current: "it-each-over-typed-rows" },
  ] as const)("files $kind under $name at $current", ({ kind, name, current }) => {
    const mapped = mapRecordsFileNameToCurrent({ kind, name });

    expect(mapped).toBe(current);
  });

  it("keeps a name no earlier release used", () => {
    const mapped = mapRecordsFileNameToCurrent({ kind: "debt", name: "claimed-type" });

    expect(mapped).toBe("claimed-type");
  });

  it("reads a deviation's name as a recipe, so a symptom's former name under deviations stays", () => {
    const mapped = mapRecordsFileNameToCurrent({
      kind: "deviations",
      name: "assertion-outside-a-test",
    });

    expect(mapped).toBe("assertion-outside-a-test");
  });

  it("reads a debt's name as a symptom, so a recipe's former name under debt stays", () => {
    const mapped = mapRecordsFileNameToCurrent({ kind: "debt", name: "stub-with-vifn" });

    expect(mapped).toBe("stub-with-vifn");
  });
});

describe("the current text of a record's answers", () => {
  it("renames a whole symptom", () => {
    const mapped = mapReachToCurrent({ text: "export-from-a-test-file" });

    expect(mapped).toBe("export-from-a-test");
  });

  it("renames the symptom of a check address and keeps the check", () => {
    const mapped = mapReachToCurrent({ text: "code-or-prose-read-as-text#raw-read" });

    expect(mapped).toBe("code-or-prose-read-as-text-in-a-test#raw-read");
  });

  it("keeps an address no earlier release used", () => {
    const mapped = mapReachToCurrent({ text: "claimed-type#cast-expressions" });

    expect(mapped).toBe("claimed-type#cast-expressions");
  });

  it("keeps text that is no recorded reach, for the reader to refuse", () => {
    const mapped = mapReachToCurrent({ text: "Assertion outside a test" });

    expect(mapped).toBe("Assertion outside a test");
  });
});

describe("the current text of a check address the settings list", () => {
  it.each([
    {
      text: "assertion-outside-a-test#assertion-site",
      current: "assertion-outside-a-test-body#assertion-site",
    },
    {
      text: "code-or-prose-read-as-text#raw-read",
      current: "code-or-prose-read-as-text-in-a-test#raw-read",
    },
    {
      text: "export-from-a-test-file#test-file-export",
      current: "export-from-a-test#test-file-export",
    },
    {
      text: "hone/export-from-a-test-file#test-file-export",
      current: "export-from-a-test#test-file-export",
    },
    { text: "claimed-type#cast-to-any", current: "claimed-type#cast-to-any" },
    { text: "hone/claimed-type#cast-to-any", current: "hone/claimed-type#cast-to-any" },
    {
      text: "acme/assertion-outside-a-test#assertion-site",
      current: "acme/assertion-outside-a-test#assertion-site",
    },
    { text: "not an address", current: "not an address" },
  ])("lists $text as $current", ({ text, current }) => {
    const mapped = mapListedAddressToCurrent({ text });

    expect(mapped).toBe(current);
  });
});
