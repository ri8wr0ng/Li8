# Test failure log

From 2026-11-21 to 2026-12-05, log every test failure you fix here, before or in the PR that fixes it.
On 2026-12-05 the log decides which test files to delete: a file whose every failure was a change
detector, and that never caught a regression, goes, and its pattern is banned in AGENTS.md.

- **Caught regression:** the test failed because the code broke behavior a user or caller relies on.
  Fixing the code was the right fix.
- **Change detector:** the test failed because the code changed in a way nobody relies on (an
  internal call order, a snapshot of markup, a private helper's shape). Fixing the test was the
  right fix.

Never deleted, whatever the log says: tests of authorization, privacy, migrations and concurrency.

| Date       | Test file                             | Test    | PR  | Kind            | What failed, in one line                                                                                     |
| ---------- | ------------------------------------- | ------- | --- | --------------- | ------------------------------------------------------------------------------------------------------------ |
| 2026-11-21 | packages/backend/convex/usage.test.ts | (setup) | #25 | Change detector | `vi.useFakeTimers({ toFake: ["Date"] })` had to become `setSystemTime` for bun's runner; no behavior changed |
