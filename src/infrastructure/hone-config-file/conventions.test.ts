import { describe, expect, it } from "vitest";
import { repoPathSchema } from "../hone-records-folder/repo-path.ts";
import { type ConventionsReading, conventionsOf, conventionsWireOf, DEFAULT_CONVENTIONS } from "./conventions.ts";

describe("DEFAULT_CONVENTIONS", () => {
  it("holds no generated folders and no layers, as no check reads either today", () => {
    expect(DEFAULT_CONVENTIONS).toEqual({ generated: [], layers: [] });
  });
});

describe("conventionsOf", () => {
  it("gives the defaults, and names no key as declared, when the file declares none", () => {
    expect(conventionsOf({ document: { layers: {} } })).toEqual({
      outcome: "ok",
      value: { conventions: DEFAULT_CONVENTIONS, declared: [] },
    });
  });

  it("reads every declared key into typed values, in place of its default, and names each one declared", () => {
    expect(
      conventionsOf({
        document: {
          generated: [{ files: ["src/graphql/generated/**", "src/api/*.gen.ts"], outsideParty: "@graphql-codegen/cli" }],
          layers: { domain: ["src/domain"], application: ["src/application"], adapters: ["src/adapters", "web/adapters"] },
        },
      }),
    ).toEqual<{ readonly outcome: "ok"; readonly value: ConventionsReading }>({
      outcome: "ok",
      value: {
        conventions: {
          generated: [{ files: ["src/graphql/generated/**", "src/api/*.gen.ts"], outsideParty: "@graphql-codegen/cli" }],
          layers: [
            { layer: "domain", folders: [repoPathSchema.parse("src/domain")] },
            { layer: "application", folders: [repoPathSchema.parse("src/application")] },
            { layer: "adapters", folders: [repoPathSchema.parse("src/adapters"), repoPathSchema.parse("web/adapters")] },
          ],
        },
        declared: ["generated", "layers"],
      },
    });
  });

  it("keeps layers inner to outer and only those declared", () => {
    expect(conventionsOf({ document: { layers: { adapters: ["src/adapters"], domain: ["src/domain"] } } })).toMatchObject({
      outcome: "ok",
      value: {
        conventions: {
          layers: [
            { layer: "domain", folders: ["src/domain"] },
            { layer: "adapters", folders: ["src/adapters"] },
          ],
        },
        declared: ["layers"],
      },
    });
  });

  type RefusalRow = { readonly name: string; readonly document: unknown; readonly refusal: string };

  it.each<RefusalRow>([
    {
      name: "a generated entry with no outside party",
      document: { generated: [{ files: ["src/generated/**"], outsideParty: "" }], layers: {} },
      refusal: "✖ Too small: expected string to have >=1 characters\n  → at generated[0].outsideParty",
    },
    {
      name: "a generated entry that names files anywhere",
      document: { generated: [{ files: ["**/*.ts"], outsideParty: "@graphql-codegen/cli" }], layers: {} },
      refusal: "✖ a generated entry names files under a named folder\n  → at generated[0].files[0]",
    },
    {
      name: "a generated entry that names files under any folder",
      document: { generated: [{ files: ["*/**"], outsideParty: "@graphql-codegen/cli" }], layers: {} },
      refusal: "✖ a generated entry names files under a named folder\n  → at generated[0].files[0]",
    },
    {
      name: "a generated entry that names files at the repository root",
      document: { generated: [{ files: ["*.ts"], outsideParty: "@graphql-codegen/cli" }], layers: {} },
      refusal: "✖ a generated entry names files under a named folder\n  → at generated[0].files[0]",
    },
    {
      name: "a generated entry that names every file",
      document: { generated: [{ files: ["*"], outsideParty: "@graphql-codegen/cli" }], layers: {} },
      refusal: "✖ a generated entry names files under a named folder\n  → at generated[0].files[0]",
    },
    {
      name: "a layer folder that is a glob",
      document: { layers: { domain: ["src/*/domain"] } },
      refusal: "✖ a layer lists folders git tracks, not globs\n  → at layers.domain[0]",
    },
    {
      name: "a layer folder inside another layer's folder",
      document: { layers: { domain: ["src"], adapters: ["src/adapters"] } },
      refusal: "✖ src/adapters is inside src; no layer folder sits inside another\n  → at layers",
    },
    {
      name: "one folder in two layers",
      document: { layers: { domain: ["src/core"], adapters: ["src/core"] } },
      refusal: "✖ src/core is listed more than once; a folder belongs to one layer, once\n  → at layers",
    },
    {
      name: "one folder twice in one layer",
      document: { layers: { domain: ["src/domain", "src/domain"] } },
      refusal: "✖ src/domain is listed more than once; a folder belongs to one layer, once\n  → at layers",
    },
    {
      name: "a layer the model does not name",
      document: { layers: { infrastructure: ["src/infrastructure"] } },
      refusal: "✖ Unrecognized key: \"infrastructure\"\n  → at layers",
    },
    {
      name: "a conventions key, which is not a category in version 2",
      document: { conventions: { generated: [] }, layers: {} },
      refusal: "✖ Unrecognized key: \"conventions\"",
    },
  ])("refuses $name", ({ document, refusal }) => {
    expect(conventionsOf({ document })).toEqual({ outcome: "failed", error: refusal });
  });
});

describe("conventionsWireOf", () => {
  it("writes nothing for conventions that were not declared", () => {
    expect(conventionsWireOf({ reading: { conventions: DEFAULT_CONVENTIONS, declared: [] } })).toEqual({});
  });

  it("writes the generated files and the layers that were declared, each under its own key", () => {
    expect(
      conventionsWireOf({
        reading: {
          conventions: {
            generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }],
            layers: [{ layer: "domain", folders: [repoPathSchema.parse("src/domain")] }],
          },
          declared: ["generated", "layers"],
        },
      }),
    ).toEqual({
      generated: [{ files: ["generated/*.ts"], outsideParty: "codegen" }],
      layers: { domain: ["src/domain"] },
    });
  });
});
