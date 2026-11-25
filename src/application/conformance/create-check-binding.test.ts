import { describe, expect, it } from "vitest";

import { editionOf } from "../../domain/rule-set/edition-of.ts";
import { ruleSetNameOf } from "../../domain/rule-set/rule-set-name-of.ts";
import { createCheckBinding } from "./create-check-binding.ts";

describe("createCheckBinding", () => {
  it("binds a team check with default settings and its default edition", () => {
    const request = {
      check: "scratch-file#scratch-files",
      ruleSet: { name: ruleSetNameOf("acme") },
      engine: "walker",
      piece: {
        anchor: { kind: "file" },
        pieceRoot: "/repo/tools/acme/piece",
        exceptions: "allowed",
        settings: { threshold: 3 },
        forms: { flagged: "scratch-file#scratch-files" },
        declarations: {
          threshold: { default: 5 },
          label: { default: "draft" },
        },
        editions: {
          declared: [editionOf("1"), editionOf("2")],
          default: editionOf("1"),
          latest: editionOf("2"),
        },
      },
    } as const;

    const binding = createCheckBinding(request);

    expect(binding).toEqual({
      address: "scratch-file#scratch-files",
      ruleSet: { name: ruleSetNameOf("acme") },
      engine: "walker",
      anchor: { kind: "file" },
      pieceRoot: "/repo/tools/acme/piece",
      settings: { threshold: 3 },
      forms: { flagged: "scratch-file#scratch-files" },
      checkSettings: { threshold: 5, label: "draft" },
      edition: "1",
    });
  });
});
