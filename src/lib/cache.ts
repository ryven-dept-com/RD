import "server-only";
import { cache } from "react";

/**
 * Per-request memoization for hot PUBLIC storefront reads
 * (store settings, categories, CMS content).
 *
 * Why React `cache()` instead of a TTL store:
 *  - Within ONE server render (layout + page + footer + navbar) the same
 *    query is only issued once — no duplicate requests, no waterfall, lower
 *    DB load. That is the real win we're after.
 *  - The memo is scoped to a single request and is never shared across
 *    requests, so admin edits are always reflected on the very next page
 *    load. This keeps checkout/admin read-after-write correctness intact —
 *    a cross-request TTL cache would briefly serve stale settings.
 *  - Never use for customer checkout, order or admin-panel data.
 */
export const memoizePerRequest = cache;
