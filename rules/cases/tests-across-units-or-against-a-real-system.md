# Tests across units or against a real system

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "tests-are-ours"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "rule": "tested-where-its-owned"
    }
  ]
}
```

Each behaviour is tested at the level that owns it. An integration test checks only a binding to the outside, or that units join. It is the only place a file on disk or a real subsystem belongs, and only the one its binding needs. It inherits nothing from the machine.
