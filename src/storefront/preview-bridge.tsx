import {
  COLOR_FIELD_VARS,
  FONT_FIELD_VARS,
} from "@/themes/customize";

/**
 * Admin customization live-preview bridge — SERVER component that emits a
 * tiny inline script, rendered ONLY when a validated admin preview session
 * is active. Customers never download it (the script tag itself is absent
 * from their HTML), and no client module is added to any bundle.
 *
 * The script listens for same-origin postMessage events from the
 * Admin → Themes → Customize panel and applies the unsaved CSS-variable
 * overrides to the [data-theme] wrapper. Pure presentation, nothing is
 * written anywhere.
 *
 * Hardening (enforced inside the generated script):
 *  - same-origin messages only;
 *  - only whitelisted CSS custom properties (the customization token set);
 *  - values restricted to a safe charset (hex colors, rgb triplets, font
 *    stacks) — anything else is dropped.
 */
export function PreviewBridge() {
  const allowedVars = JSON.stringify([
    ...Object.values(FONT_FIELD_VARS),
    ...Object.values(COLOR_FIELD_VARS),
  ]);

  // Static, hand-audited script body. The only dynamic piece (the allowlist)
  // is JSON.stringify'd from the compile-time token maps above; values are
  // additionally restricted to a safe charset before touching the DOM.
  const script = `(function(){
  var ALLOWED = new Set(${allowedVars});
  var SAFE = /^[\\w#"()',.%/ -]+$/;
  var applied = {};
  window.addEventListener("message", function(event){
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || typeof data !== "object" || data.type !== "rd-theme-live-overrides") return;
    if (!data.vars || typeof data.vars !== "object") return;
    var el = document.querySelector("[data-theme]");
    if (!el) return;
    var name;
    for (name in applied) {
      if (!Object.prototype.hasOwnProperty.call(data.vars, name)) {
        el.style.removeProperty(name);
        delete applied[name];
      }
    }
    for (name in data.vars) {
      if (!Object.prototype.hasOwnProperty.call(data.vars, name)) continue;
      if (!ALLOWED.has(name)) continue;
      var value = String(data.vars[name]);
      if (!SAFE.test(value)) continue;
      el.style.setProperty(name, value);
      applied[name] = 1;
    }
  });
})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
