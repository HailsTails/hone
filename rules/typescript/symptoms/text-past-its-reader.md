# Text past its reader

```json
{
  "group": "Text and schemas past their reader",
  "seen": "`JSON.parse`, `JSON.stringify` or a YAML parse or dump outside the adapter for whoever produced or receives the text, tests included.",
  "mayIndicate": [
    {
      "case": "reads-data-from-outside",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
        }
      ]
    },
    {
      "case": "sends-data-out-of-the-program",
      "points": [
        {
          "principle": "no-leak-across-a-boundary"
        }
      ]
    },
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "principle": "external-behaviour-sits-at-a-boundary"
        }
      ]
    },
    {
      "case": "states-what-the-unit-gives-back-for-one-case-or-several",
      "points": [
        {
          "rule": "straight-through-tests"
        }
      ]
    }
  ],
  "breachUsuallySits": "in a port that takes or gives text where it should carry objects",
  "seenBy": [
    "syntax",
    "types"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "adapter-per-outside-party",
    "map-out-at-the-adapter",
    "zod-at-the-producers-adapter",
    "whole-written-out-expectation"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "boundary-record",
      "at": "on the adapter for whoever produced or receives the text"
    },
    {
      "situation": "a use at one test site",
      "kind": "authorised-location",
      "at": "for this symptom alone"
    }
  ]
}
```

"a boundary on whoever made json"

- **How it is seen:** types to trace the port.
- **The breach a check could name:** the port that carries text, by types.
- **To name the breach, a check needs:** types: the port method the text is fed to.
