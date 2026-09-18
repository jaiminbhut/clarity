/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as assessmentSchema from "../assessmentSchema.js";
import type * as billing from "../billing.js";
import type * as coachPrompt from "../coachPrompt.js";
import type * as costs from "../costs.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib from "../lib.js";
import type * as limits from "../limits.js";
import type * as passagePrompt from "../passagePrompt.js";
import type * as passages from "../passages.js";
import type * as premiumHttp from "../premiumHttp.js";
import type * as pro from "../pro.js";
import type * as proPolicy from "../proPolicy.js";
import type * as proTables from "../proTables.js";
import type * as requestBody from "../requestBody.js";
import type * as sessions from "../sessions.js";
import type * as settings from "../settings.js";
import type * as supplements from "../supplements.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  assessmentSchema: typeof assessmentSchema;
  billing: typeof billing;
  coachPrompt: typeof coachPrompt;
  costs: typeof costs;
  crons: typeof crons;
  http: typeof http;
  lib: typeof lib;
  limits: typeof limits;
  passagePrompt: typeof passagePrompt;
  passages: typeof passages;
  premiumHttp: typeof premiumHttp;
  pro: typeof pro;
  proPolicy: typeof proPolicy;
  proTables: typeof proTables;
  requestBody: typeof requestBody;
  sessions: typeof sessions;
  settings: typeof settings;
  supplements: typeof supplements;
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

export declare const components: {};
