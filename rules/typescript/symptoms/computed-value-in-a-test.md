# Computed value in a test

```json
{
  "seen": "A test that builds or picks a value: array methods, `find`, `Math.*`, `Object.assign`, `Object.fromEntries`, `Array.from` or a spread over a list. Calls on the unit's own API are not included.",
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
    }
  ],
  "breachUsuallySits": "in the test, or in logic no unit owns",
  "recipes": [
    "whole-written-out-expectation",
    "iteach-over-typed-rows"
  ],
  "correctUses": []
}
```
