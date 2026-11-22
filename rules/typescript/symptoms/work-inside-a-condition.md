# Work inside a condition

```json
{
  "group": "Unit shape",
  "seen": "An `if` inside another `if`, or an `else` after a branch that always exits.",
  "mayIndicate": [
    {
      "case": "checks-conditions-before-its-work",
      "points": [
        {
          "rule": "guard-first"
        }
      ]
    },
    {
      "case": "does-one-job",
      "points": [
        {
          "rule": "doer-or-orchestrator"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit's questions",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "guard-clauses"
  ],
  "correctUses": []
}
```
