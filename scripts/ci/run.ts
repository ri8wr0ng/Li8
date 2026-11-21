// Runs one CI job's checks, prints every failure (not just the first), and fails any
// check, or the job, that runs over its time budget. A slow check fails here, not in a month.
//
//   bun scripts/ci/run.ts checks|test|build
import { appendFileSync } from "node:fs";

type Check = { name: string; cmd: string[]; budgetMs: number };

const GROUPS: Record<string, Check[]> = {
  checks: [
    { name: "format", cmd: ["bun", "fmt", "--check"], budgetMs: 1_000 },
    { name: "lint", cmd: ["bun", "lint"], budgetMs: 1_000 },
    { name: "typecheck", cmd: ["bun", "check"], budgetMs: 5_000 },
  ],
  test: [{ name: "test", cmd: ["bun", "test", "--isolate"], budgetMs: 30_000 }],
  build: [{ name: "build", cmd: ["bun", "run", "build"], budgetMs: 30_000 }],
};

// Whole-job budgets. Setup is measured by .github/actions/setup (SETUP_START/SETUP_END).
const SETUP_BUDGET_MS = 15_000;
const JOB_BUDGET_MS = 35_000;

const group = process.argv[2] ?? "";
const checks = GROUPS[group];
if (!checks) {
  console.error(`Usage: bun scripts/ci/run.ts ${Object.keys(GROUPS).join("|")}`);
  process.exit(2);
}

type Result = Check & { code: number; ms: number; output: string };

async function run(check: Check): Promise<Result> {
  const start = performance.now();
  const proc = Bun.spawn(check.cmd, { stdout: "pipe", stderr: "pipe", env: process.env });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ...check, code, ms: performance.now() - start, output: stdout + stderr };
}

// One at a time: in parallel they compete for cores, and each budget should time the tool,
// not the contention. Every check still runs, so every failure is listed.
const results: Result[] = [];
for (const check of checks) results.push(await run(check));
const failures: string[] = [];
const rows: string[] = [];
const ci = Boolean(process.env.CI);

for (const r of results) {
  const failed = r.code !== 0;
  const slow = r.ms > r.budgetMs;
  const status = failed ? "FAILED" : slow ? "OVER BUDGET" : "ok";
  rows.push(`| ${r.name} | ${status} | ${Math.round(r.ms)} ms | ${r.budgetMs} ms |`);
  if (failed) failures.push(`${r.name} failed (exit ${r.code})`);
  // Budgets are for CI's machines. Locally (hooks, laptops) only correctness counts.
  if (slow && ci) failures.push(`${r.name} took ${Math.round(r.ms)} ms, budget ${r.budgetMs} ms`);
  const header = `── ${r.name}: ${status} in ${Math.round(r.ms)} ms (budget ${r.budgetMs} ms) `;
  console.log(`\n${header.padEnd(100, "─")}`);
  if (failed || process.env.CI_VERBOSE) console.log(r.output.trimEnd());
}

const now = Date.now();
const setupStart = Number(process.env.SETUP_START);
const setupEnd = Number(process.env.SETUP_END);
if (ci && setupStart && setupEnd) {
  const setupMs = setupEnd - setupStart;
  const jobMs = now - setupStart;
  const cache = process.env.DEPS_CACHE_HIT === "true" ? "hit" : "miss";
  rows.push(
    `| _setup (cache ${cache})_ | ${setupMs > SETUP_BUDGET_MS ? "OVER BUDGET" : "ok"} | ${setupMs} ms | ${SETUP_BUDGET_MS} ms |`,
  );
  rows.push(
    `| _job_ | ${jobMs > JOB_BUDGET_MS ? "OVER BUDGET" : "ok"} | ${jobMs} ms | ${JOB_BUDGET_MS} ms |`,
  );
  if (setupMs > SETUP_BUDGET_MS)
    failures.push(`setup took ${setupMs} ms, budget ${SETUP_BUDGET_MS} ms`);
  if (jobMs > JOB_BUDGET_MS) failures.push(`job took ${jobMs} ms, budget ${JOB_BUDGET_MS} ms`);
}

const table = ["| Step | Result | Time | Budget |", "|---|---|---|---|", ...rows].join("\n");
console.log(`\n${table}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${group}\n\n${table}\n\n`);
}
if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s):\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  for (const f of failures) console.log(`::error title=${group}::${f}`);
  process.exit(1);
}
