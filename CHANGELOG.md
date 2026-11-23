# Changelog

Every release of Hone, newest first. `pnpm run release-pull-request` writes each new section from the commits merged to `main` since the previous release tag, whose subjects are the squash-merged pull request titles; README.md's Compatibility section says what each kind of release may change. The sections below were written by hand from the merged pull requests when the changelog started.

## 2.0.0-pre.4

### Breaking changes

- speak the named model in the walker, rule-set and testing entries (#415)

### Features

- detect process global access (#359)
- detect ambient random calls (#360)
- detect throws in production units (#361)
- detect prose in TypeScript comments (#362)
- detect global patches and stub answers in hooks (#363)
- detect floating versions and fetched tools (#364)
- ci: stable managed agents build, triage and review, invoked from issues and pull requests (#409)
- ci: review draft pull requests and hand review findings back to the builder (#428)
- ci: reviews run from main and post as rin-reviewer (#430)
- agents: triager weighs issues against ordinary use (#431)
- keep team records in their rule set's records folder (#390)
- record, prune and authorise on team rule set addresses (#408)
- hone upgrade converts a team rule set from its version 1 layout (#424)
- agent-detached label stops agent reviews and hand-backs on a pull request (#437)
- release: fold a stable release's pre-release changelog sections into one (#351) (#405)
- detect Vitest test call aliases (#385)
- detect debugger statements (#386)
- detect ambient browser dialogs in edition two (#388)
- detect conditional and todo tests in edition two (#389)
- detect exports from test files (#392)
- detect type declarations in test files (#393)
- detect empty error handlers (#394)
- detect built units called in place (#395)
- detect assertions outside test cases (#396)
- detect tests reading code or prose as text (#397)
- detect unread function parameters (#398)
- declare which files are tests with testFiles in hone.config.json (#434)
- the generated checks page shows each check's engines (#407)

### Fixes

- record-debt refuses and names project when the projection is stale (#371)
- --repo refusal and help name hone.config.json, not disciplines.json (#370)
- upgrade proof counts the files it writes, mentions every version 1 file, and says what it compared (#373)
- ci: the agent job reads the session's list cost amount (#406)
- cap hook answer snippets at eighty characters (#401)
- detect Vitest environment stubs in edition two (#402)
- ci: the agent job streams session events through a file (#425)
- lead findings with their symptom and source (#378)
- explain the problem in walker test-body remedies (#381)
- report floating versions at their manifest declarations (#411)
- detect pnpx in workflow commands (#404)
- self-check: print the gate line as the run's only verdict (#419)
- treat workspace packages and subpath imports as own API in test-body logic (#427)
- share tracker reference parsing (#414)
- an answered finding line names the fix its finding line names (#426)
- records: record-debt new-file and left lines no longer ask for a reason of its own (#418)
- continue checks around nested Hone configurations (#384)

### Other changes

- retire the output contract doc and the test that pins it to the code (#376)
- run and report version 2 checks by name (#358)
- Claude works an issue labelled claude or a comment mentioning @claude (#380)
- a Claude Managed Agent works an issue labelled claude (#400)
- record the applied agent definitions (#410)
- share TypeScript throw detection (#399)
- read team rule sets from the version 2 layout and refuse the version 1 layout by name (#383)
- share anchored walker snippets (#429)
- record the applied agent definitions (#432)
- assess debt forfeiture in Hone's own runs again (#438)

## 2.0.0-pre.3

### Fixes

- index records, measurements and declarations once instead of rescanning per hit (#365)

## 2.0.0-pre.2

### Fixes

- hone upgrade carries a carve-out that only held up a native suppression as debt (#352)
- hone upgrade points a 1.x projection's plugin imports at the 2.0 modules before its version 1 run (#353)

### Other changes

- pages stop restating the code, and prose-pinning tests go (#347)

## 2.0.0-pre.1

### Breaking changes

- Hone supports the latest release of each ESLint major (#230)
- move the repository into named layers (#318)

### Features

- every check has one address in the catalogue (#206)
- a version 2 config reader gives the same reading as version 1 (#207)
- a records reader for the five kinds under hone-records (#211)
- which findings each record answers (#212)
- one ESLint plugin whose rule ids name the symptom and the check (#213)
- an import finding names the import that raised it (#217)
- a record may name one check, and doubly held debt is paid (#216)
- the lines a version 2 run prints, and their contract (#214)
- version 2 load failures and help text (#220)
- version 2 load failures narrow by type, and one chooser picks the run path (#221)
- a hit and a native exception may name their check (#222)
- a version 2 ESLint runner that reports by symptom and check (#224)
- hone check runs on the version 2 files behind one chooser (#225)
- version 2 records are written and removed by command (#228)
- record-debt, prune-debt and authorise run on a version 2 repository (#233)
- map version 1 settings and records to version 2 values (#240)
- write version 2 settings and rewrite the team config's projection import (#243)
- a carried record stands when the base held it as a version 1 entry (#241)
- read the head's version 1 entries as inputs to the upgrade mapping (#242)
- answer version 1 file carve-outs through the moved governance (#245)
- version 2 conformance runs through the checks runner's conform (#247)
- the version 1 engine pass hands the oracle its raw findings (#248)
- debt carried from a version 1 file carve-out stands when the base held that entry (#249)
- write the upgrade's files with rollback and remove version 1's files in order (#253)
- compare a version 1 report with a version 2 report for the upgrade proof (#252)
- the upgrade proof plans, writes, runs both versions, compares and rolls back (#255)
- version 2 hone project (#256)
- hone upgrade (#258)
- compile each ESLint major alone, behind its own boundary (#238)
- version 2 runs repositories with package-level lint configs (#261)
- version 2 runs repositories that declare eslintConfigRoots (#262)
- hone upgrade carries a repository's ESLint slices to version 2 (#264)
- a version 2 projection declares its type (#271)
- carried records follow the forfeiture setting when no base is given (#285)
- record-debt answers the native exceptions a debt record can hold (#292)
- an ESLint rule id is the check's address (#301)
- the ignore line names both routes, and an excluded file prints none (#302)
- version 2 prints its report sections in kebab-case (#303)
- version 2 calls the failures-only report output actionable (#304)
- scripts is a categorical folder name (#306)
- tests and values are categorical folder names (#307)
- register checks by name in version 2 (#338)
- hone upgrade prints its record lines and the proof's finding count (#342)
- hone upgrade turns a clause-wide carve-out into not-adopted checks (#348)

### Fixes

- the vendor import scan no longer reads other tests' scratch output (#254)
- the confinement guards read imports from syntax, not text (#251)
- each cause version 2 cannot run yet prints a true line (#260)
- every version 2 finding names its check (#265)
- the upgrade keeps the verdict of a repository that selects some disciplines (#267)
- the upgrade writes an authorised location at the checks it answers (#266)
- the upgrade's proof measures against the tree it found (#268)
- the shipped ESLint plugin declaration keeps its default export (#275)
- an out-of-date projection is reported as out of date (#278)
- upgrade names directives that name no version 2 check (#280)
- a record is stale only where its checks were measured (#284)
- a folder with no settings file reports config-absent from every command (#297)
- hone --help prints version 2's help for a version 2 repository (#298)
- prune-debt drops a carve-out whose file the selection excludes (#322)
- record-debt inherits the debt of a file git sees renamed (#329)
- version-one-removal test compiles with D1's constructors (#336)

### Other changes

- shipped pages address rules, cases, symptoms and checks by name (#215)
- every indication points only at what its case owes (#218)
- version 2 runner owns the logic it shares with version 1 (#229)
- command-line handling and the checked tree have one home both versions use (#231)
- the suite drops an unshipped proof and repeated cases (#232)
- the version 2 run owns mechanism dispatch and outcome printing (#234)
- version 2 settings own the selection types, edition pin and default check settings (#235)
- move the version 1 record and settings readers under core/upgrade (#236)
- split the disciplines.json reader from selection logic and pay its test's debt (#237)
- move version 1 answering and the embedded run under core/upgrade (#239)
- the runner loader and the projection request leave version 1's reach (#244)
- ESLint conformance logic in its own version 2 file (#246)
- version 1's check outcomes leave the version 2 command line (#250)
- the version 1 engine pass against real ESLint (#257)
- clear eight self-check findings in recently merged tests (#259)
- remove the not-ready causes version 2 no longer produces (#263)
- the ESLint major imports test no longer reads other tests' scratch files (#269)
- fixture lint configs are not read as projection slices (#276)
- a version 2 adopter's whole use on one repository (#274)
- how to move a repository to version 2 with hone upgrade (#277)
- the inline-directive fixtures are text, and their debt is paid (#279)
- typed configs compile against the projection on each ESLint major (#272)
- the adopter tests expect what main prints (#281)
- self-check gates a version 2 repository by its run report (#283)
- package slices and config roots in version 2 (#282)
- one core value names every projection output (#287)
- the README teaches version 2 (#288)
- the adopting guide teaches version 2 (#289)
- links point at the version 2 headings (#290)
- the adopting guide's worked example and check table are pinned to the code (#293)
- the upgrade page covers what hone upgrade prints and refuses (#294)
- the upgrade page answers what a first adopter had to guess (#300)
- three check-command tests pay their test-body debt (#295)
- version 2 owns its command ports (#296)
- version 2 record files are named for their kinds (#308)
- generated is a top-level settings key (#309)
- why-chain-causal tests the chain code on written-out values (#310)
- the why chain's root field is rootEvidence (#311)
- a record names what it answers in answers (#312)
- delete tests/ and write what each test needs into the test (#319)
- each layer imports only inward, held by one direction test (#320)
- disable the authorised locations, exclude fixtures and rebaseline all debt (#323)
- put each test in the layer whose behaviour it asserts (#331)
- agent rules every Hone session loads (#330)
- tests hold the layers, step 2: fakes over ports and tests beside their units (#332)
- each brand is built by its own constructor over a static declaration (#335)
- pack releases on Linux and run CI's jobs side by side (#334)
- rule content, one named file per item (#333)
- the entries' wiring is proven by what it does, not by its source text (#340)
- format with oxfmt and drop Biome (#341)
- Hone upgrades itself to version 2 (#349)

## 1.5.0

### Features

- add the TypeScript symptom catalogue and its typed reader (#199)
- prune-debt removes paid debt on a file that still exists (#203)
- a finding names its symptom (#202)

### Other changes

- pages for principles, cases, rules, records and the TypeScript layer (#197)
- numbered rule pages point at the named pages (#201)
- the install-proof plan test holds no debt (#208)

## 1.4.0

### Features

- a CD-27 test-body-logic finding names the allowed form for what it flagged, and CHECKS.md shows each one, proven against every audit and ESLint clause Hone ships (#171)
- list paid ESLint debt as stale, and add hone prune-debt to remove the records of deleted files (#191)

### Fixes

- CD-41 function-length does not measure a test suite's describe body (#170)
- a CD-27 test-body-logic finding on JSON.stringify or JSON.parse points at CD-19 (#186)

### Other changes

- Hone's ESLint pieces observe sites through one boundary over ESLint's rule contract (#166)
- the ESLint runner reads lint messages and source lines through two units of their own (#177)
- CD-25 names stubs and spies with written-out answers as a unit test's doubles, and reads a double that needs behaviour as a finding (#180)
- hone check's measurement rules move from run-check into a unit of their own (#179)
- the ESLint runner reads its repository through readers named for what it asks, and its tests stub them (#181)
- CD-17, CD-27, CD-12 and the review lenses name a stub where they offered a fake clock or an in-memory fake (#188)
- hone check takes its selection through a repository, and its orchestration tests pass written-out objects (#183)

## 1.3.0

### Features

- debt records need no reason or why-chain (#147)
- record-debt skips files the ESLint projection cannot reach (#153)

### Fixes

- pass over a package.json script whose quotes do not pair, and list one naming eslint as an unreadable command-line-option (#139)

### Other changes

- keep Hone's own exception records in the split layout (#140)
- run CD-27 test-body-logic and the CD-3 clauses at edition 2, and record Hone's backlog as debt (#157)

## 1.2.0

### Features

- add CD-3 edition 2, judging the options a tsconfig.json resolves to through extends, and a required disk on the experimental audit WalkerRepository (#136)

## 1.1.0

### Features

- add hone record-debt, which writes an adopting repository's existing findings as reason-only file carve-outs (#132)
- ship a tightened check as a clause edition, with CD-27 test-body-logic edition 2 behind checkEditions (#133)
- keep exception records in a file per rule and kind, with hone split-records to migrate (#134)

### Other changes

- point the README badges and install text at the latest dist-tag (#129)
- build the package once on the release's environment and prove that tarball on Windows and Linux (#130)

## 1.0.0

### Other changes

- size each release by plain semver so a stable release leaves the zero major (#120)

## 0.1.0-pre.9

### Fixes

- publish zod, jsonc-parser and @eslint/plugin-kit as caret-range dependencies instead of bundling them (#125)

## 0.1.0-pre.8

### Fixes

- accept a leading --, print short package paths under pnpm and ship the changelog (#122)

### Other changes

- guide migrations through old-route settings, pnpm commands and exact pins (#121)

## 0.1.0-pre.7

### Features

- export folderScope and an experimental testing entry so a team can test its audit pieces from the package (#117)

### Other changes

- release: release on merge of the release pull request instead of a hand-pushed tag (#116)

## 0.1.0-pre.6

### Breaking changes

- let a clause be adopted with its mechanism not run, and remove assessment.waivedClauses and --waived-clauses (#92)
- eslint: write a projection slice per config root, with core-validated eslintConfigRoots (#86)
- cli: add --help and --version, word argument errors for the person typing, and document every printed line in a tested output contract (#96)
- let file records hold inline disables and TypeScript directives, and judge lint-script options by effect (#97)
- eslint: add CD-2#non-null-assertions for non-null and definite assignment assertions (#109)

### Features

- point each failing clause at its assessment section and its rule's Spirit at the end of a red check (#93)

### Fixes

- reserve not-adopted from mechanism ids and make its refusals say what to do (#85)
- name every missing ESLint peer, the broken ESLint config and its fix, and cap report snippets (#83)
- eslint: treat files under a broken nested ESLint config that a governing config ignores as ignored, as the team's ESLint does (#91)
- say why a check could not measure and what to run next (#94)

### Other changes

- deps: bump zod from 4.4.3 to 4.6.6 in the npm_and_yarn group across 1 directory (#54)
- give every rule a spirit page and move check mechanics to CHECKS.md (#87)
- an assessment of what each high-count clause means, written at adoption (#90)
- state how config files and clause mechanisms change across versions (#108)
- install every install-proof consumer with pnpm (#105)

## 0.1.0-pre.5

### Breaking changes

- raise the ESLint 9 peer floor to 9.28.0, the first with every bulk-suppressions option (#63)
- make the public type entries safe to call stable (#62)
- let a repository list the packages CD-19 confines, confining none by default (#66)
- permit only const assertions, read any from the type, and require tracked references on type directives (#76)

### Features

- let a run leave carve-out forfeiture to another run with assessment.forfeiture and --forfeiture (#64)
- eslint: group the projection's file records by clause set; run hone project and commit the result (#74)
- let a run leave waived clauses unrun with assessment.waivedClauses and --waived-clauses (#73)
- let disciplines.json mark a clause not-adopted, so it is neither run nor projected (#81)

### Other changes

- add the ESLint runner's internal scope set, proven to leave the report unchanged (#68)
- add the team rule set guide and prove it from a packed install (#69)

## 0.1.0-pre.4

### Breaking changes

- raise the Node floor to 22.18, test macOS and Node 24, add a security policy (#42)

### Features

- require team ESLint plugin namespaces to follow their rule set (#40)
- accept the hone/ owner prefix for the tool's own rule set (#39)
- release: add a compatibility policy, a changelog and release tooling (#44)
- publish typed entries @hailstails/hone/rule-set and experimental @hailstails/hone/audit (#60)

### Fixes

- make the pnpm lock reader fail on inline snapshots and dependency sections (#56)
- let hone check finish on large repositories without changing its report (#58)

### Other changes

- Keep versions out of the docs and guard against them coming back (#20)
- declare the authoring types without zod so they can be published (#49)
- move Hone's own repository from bun to pnpm (#50)
- add package and repository hygiene files (#57)

## 0.1.0-pre.3

### Other changes

- Stage npm releases for owner approval instead of publishing them (#19)

## 0.1.0-pre.2

### Breaking changes

- Rename the npm package from `honed` to `@hailstails/hone`; MIGRATING.md section 11 has the steps (#13)

### Other changes

- Prepare the package for npm trusted publishing (#9)
- Run the npm publish job in the npm environment (#12)
- Make `typescript` a required peer (#17)
- Reword the seven CD-19 authorised-location records for this repository (#18)

## 0.1.0-pre.1

### Features

- The first pre-release: one `hone` command with `check` and `project` subcommands, released as a tarball for the npm package `honed` (#4)
- Run Hone's own disciplines on Hone in CI (#3)

### Other changes

- Point the install steps at this repository (#1)
- Carry Hone's CD-19 authorised locations from the earlier record (#2)
- Write the release text from the tool identity, prove the package before release, and give the reserved ESLint namespace its own field (#5)
