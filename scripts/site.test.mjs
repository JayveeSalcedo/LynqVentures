// Marketing site: routing, content config and server-rendered pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { load } from './helpers/bundle.mjs';

const root = new URL('../', import.meta.url);
const marketing = JSON.parse(readFileSync(new URL('src/data/marketing.json', root)));
const { sitePage } = await load('src/site/pages.ts');
const { Home } = await load('src/site/Home.tsx');
const { Catalog } = await load('src/site/Catalog.tsx');
const { Pricing } = await load('src/site/Pricing.tsx');
const { SiteLayout } = await load('src/site/SiteLayout.tsx');
const strip = html => html.replace(/<!-- -->/g, '');
const progress = { complete: [1, 2, 21], orientation: true };

test('site routes: marketing pages vs course hashes', () => {
  for (const h of ['', '#', '#home']) assert.equal(sitePage(h), 'home', h);
  assert.equal(sitePage('#catalog'), 'catalog');
  assert.equal(sitePage('#pricing'), 'pricing');
  for (const h of ['#orientation', '#phase/1', '#lesson/7', '#catalog/x', '#unknown']) assert.equal(sitePage(h), null, h);
});

test('marketing config covers every phase and marks pricing as placeholder', () => {
  assert.equal(marketing.phases.length, 5);
  marketing.phases.forEach((p, i) => assert.equal(p.id, i + 1));
  assert.equal(marketing.pricing.placeholder, true);
  assert.ok(marketing.pricing.tiers.length >= 1);
});

test('home, catalog and pricing render with working course links', () => {
  const home = strip(renderToString(createElement(Home, { progress })));
  assert.match(home, /100/); assert.match(home, /href="#orientation"/); assert.match(home, /Continue the course/);
  const catalog = strip(renderToString(createElement(Catalog, { progress })));
  for (let p = 1; p <= 5; p++) assert.match(catalog, new RegExp(`href="#phase/${p}"`));
  assert.match(catalog, /2 \/ 20 completed/); assert.match(catalog, /1 \/ 20 completed/);
  assert.match(catalog, /Welcome to Your Founder Journey/);
  const pricing = strip(renderToString(createElement(Pricing)));
  assert.match(pricing, /placeholder/i); assert.match(pricing, /\$XX/);
  assert.match(pricing, /disabled/);
});

test('layout marks the current page in the nav', () => {
  const html = strip(renderToString(createElement(SiteLayout, { page: 'pricing' }, 'x')));
  assert.match(html, /href="#pricing" aria-current="page"/);
  assert.doesNotMatch(html, /href="#catalog" aria-current/);
});
