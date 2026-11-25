# Ports in the argument

```json
{
  "serves": [
    {
      "rule": "written-out-answers"
    }
  ],
  "standing": "accepted",
  "reason": {
    "text": "\"If it calls something and uses its output we hardcode that output using DI.\"; \"there should be absolutely no reason to be setting process env in a test, if you are doing this you have severely messed up your dependency management\".",
    "standing": "accepted"
  }
}
```

- **Method:** The unit takes its ports in its one argument object, or from the factory that built it. The test passes stubs the same way. No `vi.mock`, no global stub, no `process.env` set in a test.
- **You can tell because:** The test imports only the unit and its types. Nothing is patched.
- **Industry name:** dependency injection; constructor injection (Fowler); Pure DI (Seemann).
