import type { DisciplineFile } from "@hailstails/hone/rule-set";

export const discipline: DisciplineFile = { version: 1, id: "TEAM-1", clauses: [{ kind: "judgement", id: "named-intent", summary: "Names say what they hold.", enforcedBy: "lint" }] };
