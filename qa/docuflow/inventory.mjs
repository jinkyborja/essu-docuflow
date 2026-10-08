import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? walk(path.join(dir, f.name)) : [path.join(dir, f.name)]); }
const files = walk(path.join(root, 'src/routes'));
const route = (f) => '/' + path.relative(path.join(root, 'src/routes'), path.dirname(f)).split(path.sep).join('/');
const endpoints = files.filter((f) => f.endsWith('+server.ts')).map((f) => ({ route: route(f), file: path.relative(root, f).split(path.sep).join('/'), methods: [...fs.readFileSync(f, 'utf8').matchAll(/export const (GET|POST|PATCH|PUT|DELETE):/g)].map((m) => m[1]) }));
const pages = files.filter((f) => /\+page\.(svelte|ts)$/.test(f)).map((f) => route(f));
const schema = fs.readFileSync(path.join(root, 'database/db.sql'), 'utf8');
const tables = [...schema.matchAll(/CREATE TABLE (\w+) \(/g)].map((m) => m[1]);
const inventory = { generatedFor: '2026-10-08 audit; source inventory, not live database', roles: ['Student','Staff','Admin'], tables, pages, endpoints, endpointCount: endpoints.length, methodCount: endpoints.reduce((n,e) => n + e.methods.length, 0), statuses: ['Pending','Approved','Rejected','Correction Requested'], requestableDocumentCatalog: 'Dynamic documents table; names unavailable without isolated database/catalog access. Seed has no document inserts.', seededForms: [...schema.matchAll(/^\('([^']+)',/gm)].map((m) => m[1]) };
fs.writeFileSync(path.join(import.meta.dirname, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ pages: pages.length, tables: tables.length, endpoints: endpoints.length, methods: inventory.methodCount, seededForms: inventory.seededForms.length }));
