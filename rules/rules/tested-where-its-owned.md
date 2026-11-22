# Tested where it's owned

```json
{
  "principle": "tests-are-ours",
  "standing": "accepted",
  "lenses": [
    "test-discipline"
  ]
}
```

- **What must hold:** Every unit has a running test of its own in the file beside it, and no coverage figure stands in for it. Each behaviour is tested only at the level that owns it: a unit's logic in its own test, a binding to the outside in an integration test.
- **Source:** This is Fowler's narrow integration test; Freeman and Pryce warn against mocks at boundary objects.

Both halves answer one reason to change, which test owns a behaviour, so it stays one rule written as two sentences. A test that inherits nothing from the machine is the principle's own must-hold, so it is a case, not a rule.

- **Review:** unit tests form the bulk and component or integration tests stay few
- **Review:** an integration test targets the wiring between units, not their logic
- **Review:** no percentage coverage threshold gates a run
