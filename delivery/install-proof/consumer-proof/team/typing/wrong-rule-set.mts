import type { SymptomItem } from "@hailstails/hone/rule-set";

export const symptom: SymptomItem = { group: "Repository health", seen: "A source file calls console directly.", mayIndicate: [{ case: "changes-a-repository", points: [{ principle: "repository-ready" }] }], breachUsuallySits: "in the source change", seenBy: ["lint"], recipes: [], correctUses: [] };
