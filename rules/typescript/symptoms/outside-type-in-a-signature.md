# Outside type in a signature

```json
{
  "group": "The outside world reached directly",
  "seen": "A type from an outside dependency or runtime library in a business-logic parameter, field or return, imported or inferred.",
  "mayIndicate": [
    {
      "case": "uses-a-system-or-service-outside-the-program",
      "points": [
        {
          "rule": "outside-dependencies-stay-at-boundaries"
        },
        {
          "principle": "no-leak-across-a-boundary"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the adapter that hands the outside type inward",
  "seenBy": [
    "types"
  ],
  "reports": "seen-to-breach",
  "recipes": [
    "adapter-per-outside-party"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "authorised-location",
      "at": "on the adapter, or beyond it with a why-chain naming the outside model adopted as ours"
    }
  ],
  "breachACheckCouldName": "the adapter that returns it, by types."
}
```
