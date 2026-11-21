/// <reference types="bun" />
// Test files import from "vitest" and run under bun test, which maps "vitest" to bun:test.
// This gives them the matching types, so a vitest-only API (one bun lacks) fails the typecheck.
declare module "vitest" {
  export * from "bun:test";
}
