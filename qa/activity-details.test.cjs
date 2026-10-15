const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { compile } = require('svelte/compiler');
const { render } = require('svelte/server');

const source = fs.readFileSync('src/lib/activity-details.ts', 'utf8');
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { module, exports: module.exports, Object, JSON, Set, RegExp, Number });
const { formatActivityDetails } = module.exports;
const normalize = value => JSON.parse(JSON.stringify(value));

test('Formats form deletion metadata as affected components without repeating the summary', () => {
	const input = {
		action: 'form.deleted',
		summary: 'Deleted form #2',
		entityId: 2,
		metadata: { changedFields: ['form', 'files'] }
	};
	const expected = [{ label: 'Affected components', values: ['Form', 'Files'] }];
	assert.deepEqual(normalize(formatActivityDetails(input)), expected);
	assert.deepEqual(normalize(formatActivityDetails({ ...input, metadata: JSON.stringify(input.metadata) })), expected);
});

test('Hides missing, malformed, non-object, and unsupported metadata', () => {
	const input = { action: 'form.edited', summary: 'Updated form #2', entityId: 2 };
	for (const metadata of [null, undefined, '', 'not JSON', '[]', [], {}, { secret_note: 'private' }, { changedFields: [{ nested: 'value' }] }]) {
		assert.deepEqual(normalize(formatActivityDetails({ ...input, metadata })), []);
	}
	assert.deepEqual(normalize(formatActivityDetails({
		...input, action: 'custom.unknown', metadata: { changedFields: ['email', 'unrecognized_field'] }
	})), [{ label: 'Affected fields', values: ['Email'] }]);
});

test('Excludes sensitive and redundant fields while preserving recognized additions', () => {
	const result = formatActivityDetails({
		action: 'account.password.changed',
		summary: 'Changed account password #4',
		entityId: 4,
		metadata: { changedFields: ['password', 'email', 'role', 'password_hash', 'token'] }
	});
	assert.deepEqual(normalize(result), [{ label: 'Affected fields', values: ['Email', 'Role'] }]);
});

test('Displays unique related document IDs without repeating entity or summary IDs', () => {
	const result = formatActivityDetails({
		action: 'request.submitted',
		summary: 'Submitted request 2026: documents 2 and 20',
		entityId: 'REQ-2026',
		metadata: { ids: [2, 20, 3, '3', 0, 'REQ-4', -1, 1.5, '1234567890123456'] }
	});
	assert.deepEqual(normalize(result), [{ label: 'Related document IDs', values: ['3', '0'] }]);
});

test('Activity Details renders as a collapsed disclosure and hides when there is nothing useful', () => {
	const filename = 'src/lib/components/activity/ActivityDetails.svelte';
	const compiled = compile(fs.readFileSync(filename, 'utf8'), { filename, generate: 'server' }).js.code;
	const componentModule = { exports: {} };
	const code = ts.transpileModule(compiled, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
	}).outputText;
	vm.runInNewContext(code, {
		module: componentModule,
		exports: componentModule.exports,
		require: name => name === '$lib/activity-details' ? module.exports : require(name),
		Object, JSON, Set, RegExp, Number
	});

	const props = { action: 'form.deleted', summary: 'Deleted form #2', entityId: 2, metadata: { changedFields: ['form', 'files'] } };
	const html = render(componentModule.exports.default, { props }).body;
	assert.match(html, /<details class="activity-extra-details">/);
	assert.doesNotMatch(html, /<details[^>]*\sopen(?:\s|>)/);
	assert.match(html, /Activity Details/);
	assert.match(html, /Affected components/);
	assert.match(html, /Form/);
	assert.match(html, /Files/);
	assert.doesNotMatch(html, /\{"changedFields"/);

	const emptyHtml = render(componentModule.exports.default, { props: { ...props, metadata: null } }).body;
	assert.doesNotMatch(emptyHtml, /Activity Details|activity-extra-details/);
});
