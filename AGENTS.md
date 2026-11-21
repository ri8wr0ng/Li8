<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`packages/backend/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

Git hooks are installed by `bun install`; do not skip them with `--no-verify`.

When you fix a failing test before 2026-12-05, log it in `docs/test-failures.md` as a caught regression or a change detector. Never delete tests for authorization, privacy, migrations or concurrency.
