#!/usr/bin/env node
/**
 * Meta configuration auditor (read-only, no authentication needed).
 *
 * Verifies the LIVE state of a deployment by reading the two public Meta
 * surfaces:
 *   1. the storefront page payload — carries the Pixel configuration that
 *      the browser actually uses (enabled flag, Pixel ID, event toggles);
 *   2. GET /api/catalog — the Meta Commerce Manager feed.
 *
 * The Conversions API token is intentionally NOT visible here: it lives
 * server-side only. Check/enable CAPI in Admin → Settings → Marketing.
 *
 * Usage:
 *   BASE=https://ryven-com-ten.vercel.app node scripts/check-meta-config.mjs
 *   (optional: --pixel-id 1456620872982292)
 */

const BASE = (process.env.BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const expectedPixelId =
  (process.argv.indexOf("--pixel-id") >= 0 &&
    process.argv[process.argv.indexOf("--pixel-id") + 1]) ||
  "1456620872982292";

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  // ---- 1. storefront payload: the pixel config the browser receives ------
  const home = await fetch(`${BASE}/`, { redirect: "follow" }).catch(() => null);
  if (!home || home.status !== 200) {
    console.log(`FAIL  homepage unreachable (${BASE}) — status ${home?.status ?? "n/a"}`);
    process.exit(2);
  }
  const raw = await home.text();
  // RSC flight payloads escape quotes; normalize before matching.
  const text = raw.replace(/\\"/g, '"');
  const m = text.match(/"pixel":\{"enabled":(true|false),"id":"([^"]*)","events":\{([^}]*)\}\}/);
  if (!m) {
    record("pixel config present in storefront payload", false, "payload shape changed?");
    finish();
    return;
  }
  const [, enabledRaw, pixelId, eventsRaw] = m;
  const enabled = enabledRaw === "true";
  const ev = (key) => new RegExp(`"${key}":(true|false)`).exec(eventsRaw)?.[1] === "true";
  record("pixel config present in storefront payload", true);

  record(
    "Meta Pixel enabled",
    enabled,
    enabled ? "ON" : "OFF — enable in Admin → Settings → Marketing",
  );
  record(
    "Pixel ID is the real production pixel",
    pixelId === expectedPixelId,
    pixelId ? `found ${pixelId}` : `empty — set ${expectedPixelId}`,
  );
  record(
    "no placeholder/fake Pixel ID active",
    !enabled || /^\d{5,30}$/.test(pixelId),
    enabled ? `id=${pixelId}` : "pixel disabled",
  );

  record("PageView ON", ev("pageView"));
  record("ViewContent ON", ev("viewContent"));
  record("AddToCart OFF (not part of the official funnel)", !ev("addToCart"));
  record("InitiateCheckout ON", ev("initiateCheckout"));
  record("Purchase ON", ev("purchase"));

  record(
    "CAPI token not exposed to the browser",
    !/metaCapiAccessToken/.test(text) || !/"metaCapiAccessToken":"[^"]+"/.test(text),
  );

  // ---- 2. catalog feed ----------------------------------------------------
  const cat = await fetch(`${BASE}/api/catalog`);
  const csv = await cat.text();
  const ok = cat.status === 200 && csv.startsWith("id,title,description");
  const rows = ok ? csv.trim().split("\n").length - 1 : 0;
  record(
    "catalog feed serves machine-readable CSV",
    ok,
    ok ? `${rows} variant rows` : `status ${cat.status}`,
  );
  if (ok) {
    record("catalog prices numeric + ISO DZD", /\d+\.\d{2} DZD/.test(csv));
    record("catalog has no UI-formatted prices", !/\d{1,3}( |,)\d{3}([,.]\d+)?\s*(DA|دج)/.test(csv));
    record("catalog product links absolute", /https?:\/\/[^,\n]+\/products\//.test(csv));
    record("catalog availability machine-readable", /(in stock|out of stock)/.test(csv));
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("Action needed for: " + failed.map((f) => f.name).join(" | "));
  }
  console.log("\nNote: Conversions API delivery is server-side only — verify/enable");
  console.log("it in Admin → Settings → Marketing (requires a real CAPI access token).");
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("check-meta-config failed:", err);
  process.exit(2);
});
