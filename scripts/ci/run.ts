// Runs one CI job's checks, prints every failure (not just the first), and fails any
// check, or the job, that runs over its time budget. A slow check fails here, not in a month.
//
//   bun scripts/ci/run.ts checks|test|build
import { appendFileSync, readFileSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";
import { changedFiles, commands, select } from "./select.ts";

type Check = { name: string; cmd: string[]; budgetMs: number };

const JUNIT = join(process.env.RUNNER_TEMP ?? tmpdir(), "bun-test.xml");

// On a PR (TEST_BASE set), only the tests its diff can reach run; see select.ts. Everywhere
// else every test runs, and the run must prove it ran every test file.
const base = process.env.TEST_BASE;
const selection = base
  ? select(await changedFiles(base), base)
  : ({ kind: "all", reason: "full run" } as const);
const testChecks: Check[] = commands(selection).map((cmd, i) => ({
  name: i === 0 ? "test" : `test ${cmd.at(-1)}`,
  cmd: selection.kind === "all" ? [...cmd, "--reporter=junit", `--reporter-outfile=${JUNIT}`] : cmd,
  budgetMs: 30_000,
}));

const GROUPS: Record<string, Check[]> = {
  checks: [
    { name: "format", cmd: ["bun", "fmt", "--check"], budgetMs: 1_000 },
    { name: "lint", cmd: ["bun", "lint"], budgetMs: 1_000 },
    { name: "typecheck", cmd: ["bun", "check"], budgetMs: 5_000 },
  ],
  test: testChecks,
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

if (group === "test") {
  console.log(`\nTest selection: ${selection.reason}`);
  rows.push(`| _selection_ | ${selection.kind} | ${selection.reason} | |`);
  // A full run must have run every test file in the repo: a file bun didn't find (a bad glob,
  // a renamed directory) is a test that silently stopped running.
  if (selection.kind === "all" && results.every((r) => r.code === 0)) {
    const ran = new Set(
      [...readFileSync(JUNIT, "utf8").matchAll(/<testsuite name="([^"]+\.test\.tsx?)"/g)].map((m) =>
        (m[1] ?? "").replaceAll("\\", "/"),
      ),
    );
    const all = (await Bun.$`git ls-files "*.test.ts" "*.test.tsx"`.text())
      .split("\n")
      .filter(Boolean);
    const missing = all.filter((file) => !ran.has(file));
    rows.push(
      `| _files_ | ${missing.length ? "MISSING" : "ok"} | ${ran.size} of ${all.length} ran | |`,
    );
    for (const file of missing) failures.push(`${file} never ran`);
  }
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
    `| _job_ | ${jobMs > JOB_BUDGET_MS ? "OVER BUDGET" : "ok"} | ${jobMs} ms | ${JOB_BUDGET_MS} ms |`,
  );
  if (setupMs > SETUP_BUDGET_MS)
    failures.push(`setup took ${setupMs} ms, budget ${SETUP_BUDGET_MS} ms`);
  if (jobMs > JOB_BUDGET_MS) failures.push(`job took ${jobMs} ms, budget ${JOB_BUDGET_MS} ms`);
}

// The machine, so a budget miss can be told apart from a slower code path: on a shared runner
// pool, every check on the run slows by the same factor.
const cpu = cpus();
rows.push(`| _machine_ | ${cpu.length} cores | ${cpu[0]?.model.trim() ?? "unknown"} | |`);

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
