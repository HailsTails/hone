# Module or global patched

```json
{
  "group": "Tests",
  "seen": "`vi.mock`, `vi.stubGlobal`, a spy on a global, or `process.env` set in a test.",
  "mayIndicate": [
    {
      "case": "uses-what-a-collaborator-gives-back",
      "points": [
        {
          "rule": "written-out-answers"
        }
      ]
    },
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "situation": "a global or the environment patched",
      "points": [
        {
          "rule": "ports-declared-inside"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the unit, which imports what it should be passed",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "ports-in-the-argument"
  ],
  "correctUses": [],
  "breachACheckCouldName": "the unit that imports the module, by graph.",
  "toNameTheBreach": "graph: who imports the mocked module."
}
```
