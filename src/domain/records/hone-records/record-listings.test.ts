import { describe, expect, it } from "vitest";

import type { Check, Symptom } from "../../language-layer/symptom-catalogue.ts";
import { repoPathOf } from "../../repository/repo-path-of.ts";
import { TOOL_RULE_SET } from "../../rule-set/clause-address.ts";
import { clauseIdOf } from "../../rule-set/clause-id-of.ts";
import { disciplineIdOf } from "../../rule-set/discipline-id-of.ts";
import type { WhyChain } from "../why-chain.ts";
import type { AuthorisedLocation, PlacedRecord } from "./hone-record.ts";
import { carriedListingOf, catalogueNotesOf } from "./record-listings.ts";

describe("catalogueNotesOf", () => {
  it("notes nothing for a stated location whose check and case are the catalogue's", () => {
    const claimedType: Symptom = {
      ruleSet: "hone",
      name: "claimed-type",
      title: "Claimed type",
      seen: "A cast.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };
    const castCheck: Check = {
      name: "cast-expressions",
      symptom: claimedType,
      page: "claimed-type/cast-expressions.md",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-2"),
        clause: clauseIdOf("cast-expressions"),
      },
      engines: [],
      forms: [],
      findingSpecifics: [],
    };
    const why = { why: "Why?", because: "Because.", evidence: "src/a.ts:1" };
    const whyChain: WhyChain = {
      whys: [why, why, why, why, why],
      rootCause: "A root cause.",
      rootEvidence: "Root evidence.",
      readback: "A readback.",
      owner: "the team",
    };
    const adapter = repoPathOf("src/adapters/schemas.ts");
    const record: AuthorisedLocation = {
      kind: "authorised-location",
      symptom: claimedType,
      reach: { reaches: "one-check", check: castCheck },
      file: adapter,
      holding: {
        binding: { binds: "check-and-file" },
        held: "stated",
        owing: {
          matches: "the-catalogue",
          case: {
            name: "gives-a-value-its-type",
            title: "Gives a value its type",
            standing: "accepted",
            owes: [],
          },
          owes: {
            kind: "principle",
            principle: { name: "the-type-checker-proves-it", title: "The type checker proves it" },
          },
        },
        whyChain,
      },
    };

    const notes = catalogueNotesOf({ record });

    expect(notes).toEqual([]);
  });

  it("notes a check the catalogue does not hold, then a case it does not hold", () => {
    const claimedType: Symptom = {
      ruleSet: "hone",
      name: "claimed-type",
      title: "Claimed type",
      seen: "A cast.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };
    const why = { why: "Why?", because: "Because.", evidence: "src/a.ts:1" };
    const whyChain: WhyChain = {
      whys: [why, why, why, why, why],
      rootCause: "A root cause.",
      rootEvidence: "Root evidence.",
      readback: "A readback.",
      owner: "the team",
    };
    const adapter = repoPathOf("src/adapters/schemas.ts");
    const record: AuthorisedLocation = {
      kind: "authorised-location",
      symptom: claimedType,
      reach: { reaches: "unknown-check", check: "no-such-check" },
      file: adapter,
      holding: {
        binding: { binds: "check-and-file" },
        held: "stated",
        owing: {
          matches: "not-the-catalogue",
          note: { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
        },
        whyChain,
      },
    };

    const notes = catalogueNotesOf({ record });

    expect(notes).toEqual([
      { kind: "unknown-check", symptom: claimedType, check: "no-such-check" },
      { kind: "unknown-case", case: "needs-it-here", owes: "declared-not-asserted" },
    ]);
  });
});

describe("carriedListingOf", () => {
  it("lists each carried record by its place with what it lacks and its standing, and no stated record", () => {
    const claimedType: Symptom = {
      ruleSet: "hone",
      name: "claimed-type",
      title: "Claimed type",
      seen: "A cast.",
      mayIndicate: [],
      breachUsuallySits: "in the unit",
      recipes: [],
      correctUses: [],
    };
    const castCheck: Check = {
      name: "cast-expressions",
      symptom: claimedType,
      page: "claimed-type/cast-expressions.md",
      clause: {
        ruleSet: TOOL_RULE_SET,
        discipline: disciplineIdOf("CD-2"),
        clause: clauseIdOf("cast-expressions"),
      },
      engines: [],
      forms: [],
      findingSpecifics: [],
    };
    const adapter = repoPathOf("src/adapters/schemas.ts");
    const debtFile = repoPathOf("hone-records/debt/claimed-type.json");
    const authorisedFile = repoPathOf("hone-records/authorised-locations/claimed-type.json");
    const records: readonly PlacedRecord[] = [
      {
        place: { file: authorisedFile, index: 0 },
        record: {
          kind: "authorised-location",
          symptom: claimedType,
          reach: { reaches: "one-check", check: castCheck },
          file: adapter,
          holding: {
            binding: { binds: "check-and-file" },
            held: "carried",
            entry: { kind: "authorised-location" },
            lacks: ["case", "owes", "whyChain"],
            standing: "established",
          },
        },
      },
      {
        place: { file: debtFile, index: 0 },
        record: {
          kind: "debt",
          symptom: claimedType,
          reach: { reaches: "whole-symptom" },
          file: adapter,
          holding: { held: "carried", entry: {}, lacks: [], standing: "unjudged" },
        },
      },
      {
        place: { file: debtFile, index: 1 },
        record: {
          kind: "debt",
          symptom: claimedType,
          reach: { reaches: "whole-symptom" },
          file: adapter,
          holding: { held: "stated" },
        },
      },
      {
        place: { file: repoPathOf("hone-records/dependency-records.json"), index: 0 },
        record: {
          kind: "dependency-record",
          dependency: "zod",
          nativeWay: "hand-written parsing",
          whyNotEnough: "Each adapter would repeat its checks.",
        },
      },
    ];

    const listing = carriedListingOf({ records });

    expect(listing).toEqual([
      {
        place: { file: authorisedFile, index: 0 },
        lacks: ["case", "owes", "whyChain"],
        standing: "established",
      },
      { place: { file: debtFile, index: 0 }, lacks: [], standing: "unjudged" },
    ]);
  });
});
