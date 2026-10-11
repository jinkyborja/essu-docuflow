const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the component handlers with fake requests; never connect to the database.
function client({ approved = true, fetch } = {}) {
	const prompts = [], requests = [];
	let closes = 0;
	const source = fs.readFileSync('src/lib/components/ui/MasterlistModal.svelte', 'utf8').match(/<script lang="ts">([\s\S]*?)<\/script>/)[1] + `
		export { removeAll, loadRows, close, importFile, remove };
		export function seed(state) {
			rows = state.rows ?? []; search = state.search ?? ''; page = state.page ?? 1; total = state.total ?? 0;
			file = state.file ?? null; summary = state.summary ?? null; busy = state.busy ?? false; loading = state.loading ?? false;
		}
		export function state() { return {rows, search, page, total, file, summary, busy, loading, clearing, error, message}; }
	`;
	const exports = {};
	vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
		exports, require: name => name === 'svelte' ? {untrack: fn => fn()} : {},
		$props: () => ({open: true, onclose: () => { closes++; }}), $state: value => value, $effect() {}, URLSearchParams, FormData,
		confirm: text => { prompts.push(text); return approved; },
		fetch: async (url, options) => { requests.push({url, options}); return fetch(url, options); }
	});
	return {...exports, prompts, requests, closes: () => closes};
}
const row = {id: 21, student_id: '26-0021'};

test('Canceling the bulk-delete confirmation sends no request and keeps the current list', async () => {
	const ui = client({approved: false}); ui.seed({rows: [row], total: 21, page: 2, search: 'Juan'});
	await ui.removeAll();
	assert.equal(ui.requests.length, 0); assert.equal(ui.state().rows[0].id, 21); assert.equal(ui.state().search, 'Juan');
	assert.match(ui.prompts[0], /every masterlist entry across all pages/); assert.match(ui.prompts[0], /hidden by your search/);
	assert.match(ui.prompts[0], /Student accounts and existing verification decisions are kept/);
});

test('Confirmed deletion uses the full-list endpoint, resets pagination/search/upload and reports the deleted count', async () => {
	const ui = client({fetch: async (url, options) => ({ok: true, json: async () => options?.method === 'DELETE' ? {success: true, deleted: 41} : {rows: [], total: 0}})});
	ui.seed({rows: [row], page: 2, total: 21, search: 'Juan', file: new File(['csv'], 'masterlist.csv'), summary: {added: 2}});
	await ui.removeAll();
	assert.equal(ui.requests[0].url, '/api/masterlist'); assert.equal(ui.requests[0].options.method, 'DELETE');
	assert.equal(JSON.parse(ui.requests[0].options.body).confirm, true);
	assert.equal(ui.requests[1].url, '/api/masterlist?search=&page=1');
	const state = ui.state();
	assert.equal(state.rows.length, 0); assert.equal(state.total, 0); assert.equal(state.page, 1); assert.equal(state.search, '');
	assert.equal(state.file, null); assert.equal(state.summary, null); assert.equal(state.busy, false); assert.equal(state.clearing, false);
	assert.equal(state.error, ''); assert.equal(state.message, '41 masterlist entries deleted.');
});

test('Delete all remains usable when a search returns no entries, and an empty masterlist succeeds', async () => {
	const ui = client({fetch: async (url, options) => ({ok: true, json: async () => options?.method === 'DELETE' ? {success: true, deleted: 0} : {rows: [], total: 0}})});
	ui.seed({search: 'No matching students'}); await ui.removeAll();
	assert.equal(ui.requests[0].options.method, 'DELETE'); assert.equal(ui.state().search, '');
	assert.equal(ui.state().message, 'The masterlist is already empty.');
});

test('Failed deletion preserves displayed entries and filters, reports the error and permits retry', async () => {
	for (const failure of ['server', 'network', 'invalid-json']) {
		const ui = client({fetch: async () => {
			if (failure === 'network') throw new Error('Network failed');
			return {ok: false, json: async () => { if (failure === 'invalid-json') throw new SyntaxError('Bad response'); return {error: 'Deletion failed'}; }};
		}});
		ui.seed({rows: [row], page: 2, total: 21, search: 'Juan'}); await ui.removeAll();
		const state = ui.state();
		assert.equal(state.rows[0].id, 21); assert.equal(state.page, 2); assert.equal(state.total, 21); assert.equal(state.search, 'Juan');
		assert.ok(state.error); assert.equal(state.message, ''); assert.equal(state.busy, false); assert.equal(state.clearing, false);
		assert.equal(ui.requests.length, 1);
	}
});

test('An active deletion blocks duplicate submissions, imports, single deletes and closing until it finishes', async () => {
	let complete;
	const pending = new Promise(resolve => { complete = resolve; });
	const ui = client({fetch: async (url, options) => options?.method === 'DELETE' ? pending : {ok: true, json: async () => ({rows: [], total: 0})}});
	ui.seed({rows: [row], file: new File(['csv'], 'masterlist.csv')});
	const deletion = ui.removeAll(); assert.equal(ui.state().busy, true); assert.equal(ui.state().clearing, true);
	await ui.removeAll(); await ui.remove(row); await ui.importFile(); ui.close();
	assert.equal(ui.prompts.length, 1); assert.equal(ui.requests.length, 1); assert.equal(ui.closes(), 0);
	complete({ok: true, json: async () => ({success: true, deleted: 1})}); await deletion;
	assert.equal(ui.state().message, '1 masterlist entry deleted.'); ui.close(); assert.equal(ui.closes(), 1);
});
