# Sends data out of the program

```json
{
  "standing": "accepted",
  "owes": [
    {
      "principle": "no-leak-across-a-boundary"
    },
    {
      "principle": "one-place-decides"
    },
    {
      "rule": "one-reason-per-module"
    }
  ]
}
```

Business logic hands the adapter our own value. Only the adapter maps it to the receiver's form.
