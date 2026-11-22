# Answer set in a hook

```json
{
  "group": "Tests",
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
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "stub-with-vifn"
  ],
  "correctUses": []
}
```

"Nothing wrong with a reset in after each. But something wrong with a remock in after each. Implies the suite knows the input needed for each test." Sharing alone is not the breach: "I have no issue with shared boilerplate or even mock builders when it doesn't hide minimal interfaces issues and doesn't hide assumptions or coupling between tests. But it often does when not done with care."
