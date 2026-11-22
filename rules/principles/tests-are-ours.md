# Tests are ours

```json
{}
```

- **Must hold:** A test fails only when what the code it tests returns or calls changes.
- **Protects:** Red means "this unit broke" and nothing else.
- **Reason to change:** The world around the unit changes: a clock, a machine, a collaborator.
- **Breach:** In the unit that reads the world itself (also a breach of External behaviour sits at a boundary), or whose port cannot take a plain stub (also a breach of One place decides). Shows in the test: computed expectations, stubs with logic, module mocks, waits.
- **Source:** Freeman and Pryce teach that you mock only types you own; this principle keeps tests on what is ours.
- **Quoted reasons:** "testing what is ours not what isn't. And limiting fragility." "tests that turn red for the right reasons". "A unit test is a why that exposes coupling and side effects."
