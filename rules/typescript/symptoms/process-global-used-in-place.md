# Process global used in place

```json
{
  "group": "The outside world reached directly",
  "seen": "`process.env`, `process.argv`, `process.exit`, `process.on`, `console.*` or `globalThis` read outside an adapter.",
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
      "case": "causes-an-effect",
      "points": [
        {
          "rule": "ports-declared-inside"
        }
      ]
    },
    {
      "case": "builds-the-real-implementations",
      "points": [
        {
          "rule": "ports-declared-inside"
        }
      ]
    }
  ],
  "breachUsuallySits": "at a missing port, or at an adapter not built at the entry point",
  "seenBy": [
    "syntax"
  ],
  "reports": "seen",
  "recipes": [
    "world-values-through-a-port",
    "adapter-per-outside-party",
    "composition-root"
  ],
  "correctUses": [
    {
      "situation": "correct use",
      "kind": "boundary-record",
      "at": "on the adapter that wraps the process"
    }
  ]
}
```

"Process env reader is just an external world being wrapped."
