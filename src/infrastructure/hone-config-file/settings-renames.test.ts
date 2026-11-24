import { describe, expect, it, vi } from "vitest";

import { renameKeys } from "./settings-renames.ts";

describe("renameKeys", () => {
  it("renames each listed key under checks and checkSettings, leaving the rest of the text as written", () => {
    const text = `{
  "version": 2,
  "checks": {
    "claimed-type#cast-to-any": "walker",
    "export-from-a-test-file#test-file-export": "walker"
  },
  "checkSettings": {
    "export-from-a-test-file#test-file-export" : { "folders": ["src"] }
  }
}
`;
    const rename = vi
      .fn<(request: { readonly text: string }) => string>()
      .mockReturnValueOnce("claimed-type#cast-to-any")
      .mockReturnValueOnce("export-from-a-test#test-file-export")
      .mockReturnValueOnce("export-from-a-test#test-file-export")
      .mockReturnValueOnce("claimed-type#cast-to-any")
      .mockReturnValueOnce("export-from-a-test#test-file-export")
      .mockReturnValueOnce("export-from-a-test#test-file-export");

    const renamed = renameKeys({ text, under: ["checks", "checkSettings"], rename });

    expect(renamed).toEqual({
      outcome: "ok",
      value: {
        text: `{
  "version": 2,
  "checks": {
    "claimed-type#cast-to-any": "walker",
    "export-from-a-test#test-file-export": "walker"
  },
  "checkSettings": {
    "export-from-a-test#test-file-export" : { "folders": ["src"] }
  }
}
`,
        renamed: [
          {
            under: "checks",
            from: "export-from-a-test-file#test-file-export",
            to: "export-from-a-test#test-file-export",
          },
          {
            under: "checkSettings",
            from: "export-from-a-test-file#test-file-export",
            to: "export-from-a-test#test-file-export",
          },
        ],
        listed: [
          {
            under: "checks",
            checks: ["claimed-type#cast-to-any", "export-from-a-test-file#test-file-export"],
          },
          { under: "checkSettings", checks: ["export-from-a-test-file#test-file-export"] },
        ],
      },
    });
  });

  it("returns the text unchanged, renaming nothing, when the map keeps every key", () => {
    const text = '{"version": 2, "checks": {"claimed-type#cast-to-any": "walker"}}\n';
    const rename = vi
      .fn<(request: { readonly text: string }) => string>()
      .mockReturnValue("claimed-type#cast-to-any");

    const renamed = renameKeys({ text, under: ["checks"], rename });

    expect(renamed).toEqual({
      outcome: "ok",
      value: {
        text,
        renamed: [],
        listed: [{ under: "checks", checks: ["claimed-type#cast-to-any"] }],
      },
    });
  });

  it("asks for no name, and renames nothing, outside the listings it is given", () => {
    const text = '{"checkSettings": {"export-from-a-test-file#test-file-export": {}}}';
    const rename = vi.fn<(request: { readonly text: string }) => string>();

    const renamed = renameKeys({ text, under: ["checks"], rename });

    expect(renamed).toEqual({ outcome: "ok", value: { text, renamed: [], listed: [] } });
    expect(rename).not.toHaveBeenCalled();
  });

  it("lists both a key and the key it is renamed to, leaving the choice between them to the caller", () => {
    const text =
      '{"checks": {"export-from-a-test-file#test-file-export": "walker", "export-from-a-test#test-file-export": "eslint"}}';
    const rename = vi
      .fn<(request: { readonly text: string }) => string>()
      .mockReturnValue("export-from-a-test#test-file-export");

    const renamed = renameKeys({ text, under: ["checks"], rename });

    expect(renamed).toEqual({
      outcome: "ok",
      value: {
        text: '{"checks": {"export-from-a-test#test-file-export": "walker", "export-from-a-test#test-file-export": "eslint"}}',
        renamed: [
          {
            under: "checks",
            from: "export-from-a-test-file#test-file-export",
            to: "export-from-a-test#test-file-export",
          },
        ],
        listed: [
          {
            under: "checks",
            checks: [
              "export-from-a-test-file#test-file-export",
              "export-from-a-test#test-file-export",
            ],
          },
        ],
      },
    });
  });

  it("refuses settings where a renamed key also appears outside the listings, rewriting nothing it did not mean to", () => {
    const text =
      '{"checks": {"export-from-a-test-file#test-file-export": "walker"}, "layers": {"export-from-a-test-file#test-file-export": []}}';
    const rename = vi
      .fn<(request: { readonly text: string }) => string>()
      .mockReturnValue("export-from-a-test#test-file-export");

    const renamed = renameKeys({ text, under: ["checks", "checkSettings"], rename });

    expect(renamed).toEqual({
      outcome: "failed",
      error: { kind: "renamed-address-outside-listings", listings: ["checks", "checkSettings"] },
    });
  });

  it("refuses text that is not a JSON object", () => {
    const rename = vi.fn<(request: { readonly text: string }) => string>();

    const renamed = renameKeys({ text: "[]", under: ["checks"], rename });

    expect(renamed).toEqual({
      outcome: "failed",
      error: { kind: "malformed", detail: "the settings are not a JSON object" },
    });
  });

  it("refuses text that is not JSON, naming the parser's reason", () => {
    const rename = vi.fn<(request: { readonly text: string }) => string>();

    const renamed = renameKeys({ text: "{", under: ["checks"], rename });

    expect(renamed).toEqual({
      outcome: "failed",
      error: {
        kind: "malformed",
        detail: "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      },
    });
  });
});
