# Rebinding

```json
{
  "group": "Effects and state",
  "seen": "A `let` assigned again, or a parameter reassigned, incremented or destructured into.",
  "mayIndicate": [
    {
      "case": "makes-a-new-value-from-what-it-has",
      "points": [
        {
          "principle": "no-hidden-effects"
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
      "case": "uses-what-a-collaborator-gives-back",
      "situation": "in a test",
      "points": [
        {
          "rule": "written-out-answers"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit: no caller sees it, so on its own it shows no hidden effect, but it is suspect for work done inline in steps",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "copy-never-write-in",
    "functional-iteration"
  ],
  "correctUses": []
}
```
