# Long function

```json
{
  "group": "Unit shape",
  "seen": "A function body over the line limit.",
  "mayIndicate": [
    {
      "case": "coordinates-other-units",
      "points": [
        {
          "rule": "doer-or-orchestrator"
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
    },
    {
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "handed-what-it-uses"
        }
      ]
    },
    {
      "case": "checks-conditions-before-its-work",
      "points": [
        {
          "rule": "guard-first"
        }
      ]
    },
    {
      "case": "puts-code-in-a-file-or-folder",
      "points": [
        {
          "rule": "one-reason-per-module"
        }
      ]
    },
    {
      "case": "names-something",
      "points": [
        {
          "rule": "one-word-everywhere"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit: several jobs, an input wider than its use, nested questions, or a responsibility not isolated and named",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "composed-orchestrator",
    "guard-clauses",
    "one-argument-object"
  ],
  "correctUses": [
    {
      "situation": "a function whose shape an outside contract fixes",
      "kind": "authorised-location",
      "at": "in the file that holds it"
    }
  ]
}
```
