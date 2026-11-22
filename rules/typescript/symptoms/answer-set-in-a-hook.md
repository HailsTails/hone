# Answer set in a hook

```json
{
  "seen": "A test hook that gives a stub its answer (`mockReturnValue`, `mockResolvedValue`, `mockImplementation`) or reassigns a value the tests read. A plain reset in `afterEach` is not this symptom.",
  "mayIndicate": [
    {
      "case": "states-what-the-unit-gives-back-for-one-case-or-several",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    },
    {
      "case": "uses-what-a-collaborator-gives-back",
      "points": [
        {
          "rule": "written-out-answers"
        }
      ]
    },
    {
      "case": "keeps-state-or-settings-across-calls",
      "points": [
        {
          "principle": "no-hidden-effects"
        }
      ]
    }
  ],
  "breachUsuallySits": "in a double or a value shared across tests at file or suite scope, or in state held in the unit's module",
  "recipes": [
    "stub-with-vifn"
  ],
  "correctUses": []
}
```
