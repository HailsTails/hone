# Outside type in a signature

```json
{
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
  "recipes": [
    "adapter-per-outside-party"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "boundary-record",
      "at": "on the adapter, or beyond it with a Conformist statement for an outside model adopted as ours"
    }
  ]
}
```
