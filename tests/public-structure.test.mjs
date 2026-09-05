import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const require = createRequire(import.meta.url);

// Exercise SSR with the installed React/Motion packages, without a server or DB.
function loadTs(path, overrides = {}) {
  const code = ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name),
    loadedModule, loadedModule.exports,
  );
  return loadedModule.exports;
}

test("homepage stays server-side with unchanged server data retrieval", () => {
  const home = source("app/page.tsx");
  assert.match(home, /export default async function Home/);
  assert.match(home, /Promise\.all\(\[getPublicNotices\(\), getPublicEvents\(\)\]\)/);
  assert.doesNotMatch(home, /use client|framer-motion|<motion\./);
  assert.match(home, /<main id="main-content">/);
  assert.ok(home.indexOf("<SiteHeader />") < home.indexOf("<main"));
  assert.ok(home.indexOf("</main>") < home.indexOf("<footer"));
});

test("header has one ordinary navigation and explicit disclosure dismissal", () => {
  const header = source("components/site-header.tsx");
  assert.equal((header.match(/<nav\b/g) ?? []).length, 1);
  assert.doesNotMatch(header, /mobile-menu-overlay|role="menu"|motion\./);
  assert.match(header, /aria-expanded=\{open\}/);
  assert.match(header, /aria-controls="school-navigation"/);
  assert.match(header, /event.key === "Escape"/);
  assert.match(header, /trigger.current\?\.focus\(\)/);
  assert.match(header, /pointerdown/);
  assert.match(header, /onBlur/);
});

test("reveal SSR is readable without browser globals or JavaScript enhancement", () => {
  const hook = loadTs("hooks/use-reduced-motion.ts");
  const Reveal = loadTs("components/reveal.tsx", { "@/hooks/use-reduced-motion": hook }).default;
  const html = renderToStaticMarkup(React.createElement(Reveal, { delay: 120 }, "School content"));
  assert.match(html, /School content/);
  assert.doesNotMatch(html, /opacity:\s*0|visibility:\s*hidden|display:\s*none|translate/);
});

test("reduced motion has a conservative stable server snapshot", () => {
  const { useReducedMotion } = loadTs("hooks/use-reduced-motion.ts");
  function Preference() { return React.createElement("span", null, String(useReducedMotion())); }
  assert.equal(renderToStaticMarkup(React.createElement(Preference)), "<span>true</span>");
  const reveal = source("components/reveal.tsx");
  assert.match(reveal, /controls.stop\(\)/);
  assert.match(reveal, /initial=\{false\}/);
  assert.doesNotMatch(reveal, /new IntersectionObserver|opacity:/);
});

test("CSS no longer hides reveals or styles duplicate overlay links", () => {
  const css = source("app/polish.css");
  assert.doesNotMatch(css, /\.reveal\{opacity:0|data-visible|hero-reveal/);
  assert.doesNotMatch(source("app/globals.css"), /\.mobile-menu/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /scroll-behavior:auto/);
  assert.match(css, /\.button:hover\{transform:none\}/);
});

test("restored layout hooks have direct children and a single contact grid", () => {
  const home = source("app/page.tsx");
  assert.match(home, /programmes.map\([\s\S]*?=> <Reveal/);
  assert.equal((home.match(/className="contact-grid"/g) ?? []).length, 1);
  assert.match(source("components/site-header.tsx"), /<Link className="staff-login"/);
});
