# Schema past its adapter

```json
{
  "seen": "A schema, a `.parse` call or a `z.infer` type outside the producer's adapter, or the same value parsed twice.",
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
      "case": "gives-a-value-its-type",
      "points": [
        {
          "rule": "declared-not-asserted"
        }
      ]
    }
  ],
  "breachUsuallySits": "in the adapter, which hands the wire type inward instead of mapping it",
  "recipes": [
    "zod-at-the-producers-adapter"
  ],
  "correctUses": [
    {
      "situation": "an outside model adopted as ours",
      "kind": "boundary-record",
      "at": "with a Conformist statement"
    }
  ]
}
```
