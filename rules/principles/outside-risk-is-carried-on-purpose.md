# Outside risk is carried on purpose

```json
{}
```

- **Must hold:** No outside code or tool is used by us, or changes version, except by a recorded decision of ours.
- **Protects:** The upkeep we carry for other people's code (upgrades, vulnerabilities, drift) is upkeep we chose.
- **Reason to change:** The risk an outside party's code puts on our upkeep changes: a release, a vulnerability, a compromise, an abandoned project.
- **Breach:** In the manifest, the lock file, the pipeline or a vendored copy. Shows as an outside dependency with no record, a version that floats, a tool fetched at run time, a copy of upstream code that has drifted.
- **Differs from External behaviour sits at a boundary:** that principle keeps an outside change from editing business logic. This one decides whether the outside thing is here at all, and at which version.
- **Source:** This follows Twelve-Factor, OpenSSF and the SBOM: every dependency is declared, pinned and recorded.
- **Quoted reasons:** "it sounds like packages is a rule not a principle. The principles is something to do with external risks impact on maintenance." "Packages need a justification for the maintenance they add. And native things are preferred when they achieve the same thing without over levels of complexity." On type-only outside dependencies: "Has to be a real inescapable need which is unlikely to happen."
