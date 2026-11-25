import { describe, expect, it } from "vitest";

import { repoPathOf } from "../../domain/repository/repo-path-of.ts";
import { editionOf } from "../../domain/rule-set/edition-of.ts";
import { createCaseUnderTest } from "./create-case-under-test.ts";

describe("createCaseUnderTest", () => {
  it("gives an example without an edition the default edition", () => {
    const request = {
      example: {
        name: "first edition",
        fileName: repoPathOf("src/first.ts"),
        source: "const first = 1;",
        expectedLines: [],
      },
      defaultEdition: editionOf("1"),
    };

    const created = createCaseUnderTest(request);

    expect(created).toEqual({
      name: "first edition",
      file: "src/first.ts",
      source: "const first = 1;",
      edition: "1",
    });
  });

  it("preserves an explicit example edition", () => {
    const request = {
      example: {
        name: "second edition",
        fileName: repoPathOf("src/second.ts"),
        source: "const second = 2;",
        expectedLines: [1],
        edition: editionOf("2"),
      },
      defaultEdition: editionOf("1"),
    };

    const created = createCaseUnderTest(request);

    expect(created).toEqual({
      name: "second edition",
      file: "src/second.ts",
      source: "const second = 2;",
      edition: "2",
    });
  });
});
