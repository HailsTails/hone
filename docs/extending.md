# Extending Hone with your own rule set

A team rule set holds a team's own symptoms and checks in the team's repository. `hone check` runs them beside Hone's own, and records answer them the same way. Write one when your team wants a check Hone does not ship, rather than forking Hone or editing a shipped rule.

The `acme` rule set Hone's install proof runs is a working example: [delivery/install-proof/consumer-proof/team/tools/disciplines/acme](https://github.com/HailsTails/hone/tree/main/delivery/install-proof/consumer-proof/team/tools/disciplines/acme).

## Start one

1. Pick a folder, name it under `ruleSets` in `hone.config.json`, and select its checks as `<rule set>/<symptom>#<check>`.
2. Write each symptom and check as an item under the folder's `rules/`, laid out as Hone's own [rules](../rules/README.md). `@hailstails/hone/rule-set` types each item's facts. A case's name must be its title in lower case with hyphens, leaving out any part in brackets. A symptom's indication may point only at a principle or rule its case owes. A recipe's `serves` lists each rule or principle it serves, and a symptom may list a recipe, and a recipe's example may answer a check's form, only where one of them is indicated by the symptom.
3. Write each check's piece under `engines/<engine>/<symptom>/<check>/`, with its examples beside it. Use ESLint for what a lint rule can see, and the walker (`@hailstails/hone/walker`) for files and names ESLint never reads. A remedy a piece reports names its `fix` and the `form` it matched, and no page.
4. Test each piece against its examples with `checkConformanceOf` from `@hailstails/hone/testing`, naming the rule set and its root. An empty list means the piece meets every example.
