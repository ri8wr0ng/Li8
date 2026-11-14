/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as aiModels from "../aiModels.js";
import type * as assistantData from "../assistantData.js";
import type * as auth from "../auth.js";
import type * as chat from "../chat.js";
import type * as embeddings from "../embeddings.js";
import type * as lib from "../lib.js";
import type * as notes from "../notes.js";
import type * as rateLimits from "../rateLimits.js";
import type * as series from "../series.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  aiModels: typeof aiModels;
  assistantData: typeof assistantData;
  auth: typeof auth;
  chat: typeof chat;
  embeddings: typeof embeddings;
  lib: typeof lib;
  notes: typeof notes;
  rateLimits: typeof rateLimits;
  series: typeof series;
  usage: typeof usage;
  users: typeof users;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authGoogle: import("@convex-dev/auth/components/google/_generated/component.js").ComponentApi<"authGoogle">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
