// Run with: node qa/action-menus.browser.mjs [--request-wizard-only|--document-preview-only]
// Uses installed Vite/Svelte and headless Edge/Chrome, with no QA accounts or extra packages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const root = process.cwd();
const focusedRequestWizard = process.argv.includes('--request-wizard-only');
const focusedDocumentPreview = process.argv.includes('--document-preview-only');
const focusedStudentEdit = process.argv.includes('--student-edit-only');
const focusedBrowserFlow = focusedRequestWizard || focusedDocumentPreview || focusedStudentEdit;
const browserPath = process.env.QA_BROWSER_PATH ?? [
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'/usr/bin/chromium', '/usr/bin/google-chrome'
].find(filename => fs.existsSync(filename));
assert(browserPath, 'Set QA_BROWSER_PATH to an installed Chromium browser');
const output = path.resolve('.svelte-kit/action-menu-qa');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'browser-profile-'));
const navigation = path.resolve('qa/fixtures/action-menus/navigation.js');
const forms = path.resolve('qa/fixtures/action-menus/forms.js');
const server = await createServer({
	configFile: false, root, plugins: [svelte(), tailwindcss()],
	resolve: { alias: { '$lib': path.resolve('src/lib'), '$app/navigation': navigation, '$app/stores': navigation, '$app/environment': navigation, '$app/forms': forms } },
	server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/.svelte-kit/**'] } }, logLevel: 'error'
});
await server.listen();
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = spawn(browserPath, [
	'--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
	'--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
	let browserLog = '';
	browser.stderr.on('data', chunk => browserLog += chunk);
	const deadline = Date.now() + 20000;
	const portFile = path.join(profile, 'DevToolsActivePort');
	let port;
	while (!port) {
		assert(Date.now() < deadline && browser.exitCode === null, `Browser did not start: ${browserLog}`);
		try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0]; } catch { /* Edge may still be writing the port file. */ }
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
	socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
	await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
	let nextId = 0;
	const pending = new Map(), errors = [];
	socket.onmessage = event => {
		const message = JSON.parse(event.data);
		if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
		if (message.id && pending.has(message.id)) {
			const { resolve, reject, timer } = pending.get(message.id);
			clearTimeout(timer); pending.delete(message.id);
			message.error ? reject(message.error) : resolve(message.result);
		}
	};
	function command(method, params = {}) {
		return new Promise((resolve, reject) => {
			const id = ++nextId;
			const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
			pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
		});
	}
	async function evaluate(expression) {
		const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
		assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
		return result.result.value;
	}
	async function waitFor(expression) {
		for (let index = 0; index < 300; index++) {
			if (await evaluate(expression)) return;
			await new Promise(resolve => setTimeout(resolve, 100));
		}
		throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}\n${JSON.stringify(errors)}`);
	}
	async function load(view, role = 'Admin') {
		const run = String(Date.now()) + Math.random();
		const result = await command('Page.navigate', { url: `${origin}/qa/fixtures/action-menus/index.html?view=${view}&role=${role}&run=${run}` });
		assert(!result.errorText, result.errorText);
		await waitFor(`window.fixtureRun === ${JSON.stringify(run)} && document.querySelector('h1')?.textContent === ${JSON.stringify(view)} && !!document.querySelector('.row-menu-trigger')`);
		await evaluate('document.fonts.ready');
		if (view === 'students') await waitFor("window.fixtureCalls.some(call => call.url === '/api/requests') && !document.body.innerText.includes('Checking linked requests')");
	}
	async function key(key, modifiers = 0) {
		await command('Input.dispatchKeyEvent', { type: 'keyDown', key, modifiers,
			text: key === 'Enter' ? '\r' : key.length === 1 ? key : undefined,
			windowsVirtualKeyCode: ({ Tab: 9, Enter: 13, Escape: 27, ' ': 32, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40 })[key] });
		await command('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
	}
	async function mouseClick(selector, index = 0) {
		const point = await evaluate(`(() => { const element = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(item => item.getClientRects().length)[${index}]; const rect = element.getBoundingClientRect(); return {x:rect.left + rect.width / 2, y:rect.top + rect.height / 2}; })()`);
		await command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
		await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 });
		await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 });
	}
	async function openRow(index) {
		await evaluate(`(async () => {
			window.qaTrigger = [...document.querySelectorAll('.action-buttons .row-menu-trigger, .staff-row-actions .row-menu-trigger')].filter(button => button.getClientRects().length)[${index}];
			qaTrigger.scrollIntoView({block: 'center', inline: 'center'});
			await new Promise(requestAnimationFrame); qaTrigger.click();
		})()`);
		await waitFor("!!document.querySelector('.row-menu-panel:popover-open')");
		assert(await evaluate('qaTrigger.getBoundingClientRect().left >= 0 && qaTrigger.getBoundingClientRect().right <= innerWidth'), 'Trigger is reachable through table scrolling');
	}
	async function assertMenu(context) {
		const geometry = await evaluate(`(() => {
			const menu = document.querySelector('.row-menu-panel:popover-open'), rect = menu.getBoundingClientRect();
			return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
				width: innerWidth, height: innerHeight, scrollX: menu.scrollWidth - menu.clientWidth,
				scrollY: menu.scrollHeight - menu.clientHeight,
				visibleItems: [...menu.querySelectorAll('[role=menuitem]')].every(item => {
					const r = item.getBoundingClientRect(); return r.left >= rect.left && r.right <= rect.right && r.top >= rect.top && r.bottom <= rect.bottom;
				}) };
		})()`);
		assert(geometry.left >= 7 && geometry.top >= 7 && geometry.right <= geometry.width - 7 && geometry.bottom <= geometry.height - 7, `${context}: viewport ${JSON.stringify(geometry)}`);
		assert(geometry.scrollX <= 1 && geometry.scrollY <= 1 && geometry.visibleItems, `${context}: clipping/scrollbars ${JSON.stringify(geometry)}`);
	}
	await command('Page.enable'); await command('Runtime.enable');
	let menuChecks = 0;
	if (!focusedBrowserFlow) {
	for (const width of [320, 375, 390, 430, 767, 768, 1024, 1280, 1440, 1920]) {
		await command('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
		for (const view of ['staff', 'students', 'requests']) {
			await load(view);
			if (view === 'staff') {
				const directory = await evaluate(`(() => {
					const card = document.querySelector('.staff-directory');
					const rows = [...document.querySelectorAll('.staff-row')];
					return {
						oneContainer: !!card && rows.length === 9 && rows.every(row => card.contains(row)),
						noIndividualCards: !document.querySelector('.staff-member-card, .staff-card-grid'),
						hasAdminAndStaff: [...document.querySelectorAll('.staff-role')].some(role => role.textContent.trim() === 'Admin') &&
							[...document.querySelectorAll('.staff-role')].some(role => role.textContent.trim() === 'Staff'),
						longEmailFits: rows[0]?.querySelector('.staff-email')?.scrollWidth <= rows[0]?.querySelector('.staff-email')?.clientWidth,
						actionsFit: rows.every(row => {
							const action = row.querySelector('.staff-row-actions .row-menu-trigger').getBoundingClientRect();
							const rowRect = row.getBoundingClientRect();
							return action.left >= rowRect.left && action.right <= rowRect.right;
						}),
						headerVisible: getComputedStyle(document.querySelector('.staff-table-header')).display !== 'none',
						mobileLabelsVisible: getComputedStyle(document.querySelector('.staff-mobile-label')).display !== 'none',
						pageOverflow: document.documentElement.scrollWidth > innerWidth
					};
				})()`);
				assert(directory.oneContainer && directory.noIndividualCards, `Staff directory uses one shared container at ${width}`);
				assert(directory.hasAdminAndStaff && directory.longEmailFits && directory.actionsFit, `Staff rows fit and retain account details at ${width}`);
				assert(directory.headerVisible === (width >= 768) && directory.mobileLabelsVisible === (width < 768), `Staff columns adapt at ${width}`);
				assert(!directory.pageOverflow, `Staff directory has no horizontal overflow at ${width}`);
			}
			if (view === 'students') {
				await evaluate("window.qaFilterToggle = document.querySelector('.student-filter-toggle'); if (qaFilterToggle?.getClientRects().length) qaFilterToggle.click()");
				await waitFor("!qaFilterToggle?.getClientRects().length || qaFilterToggle.getAttribute('aria-expanded') === 'true'");
				const heights = await evaluate("[...document.querySelectorAll('.student-filter-controls select')].filter(control => control.getClientRects().length).map(control => control.getBoundingClientRect().height)");
				assert(heights.length > 0 && heights.every(height => height >= 44), `Student filters meet touch sizing at ${width}: ${heights}`);
				const records = await evaluate(`(() => {
					const mobile = innerWidth < 1024;
					const cards = [...document.querySelectorAll('.student-card')].filter(card => card.getClientRects().length);
					const table = document.querySelector('.student-table-wrap');
					const desktopVisible = table && getComputedStyle(table).display !== 'none';
					const groups = [...document.querySelectorAll('.student-card-footer .action-buttons, .student-table-wrap .actions-cell .action-buttons')].filter(group => group.getClientRects().length);
					const first = groups[0];
					const primary = first?.querySelector('.ui-button').getBoundingClientRect();
					const more = first?.querySelector('.row-menu-trigger').getBoundingClientRect();
					return {
						mobile,
						cardsComplete: cards.length === 9 && cards.every(card => card.querySelector('.student-email') && card.querySelector('.student-card-program .program-value') &&
							card.querySelector('.student-card-statuses [aria-label^="Email status"]') && card.querySelector('.student-card-statuses [aria-label^="ID status"]') &&
							card.querySelector('.student-card-registered time') && card.querySelector('.student-card-footer .row-menu-trigger')),
						emailWraps: mobile
							? cards[0]?.querySelector('.student-email').scrollWidth <= cards[0]?.querySelector('.student-email').clientWidth
							: [...table.querySelectorAll('.student-email')].every(email => email.scrollWidth <= email.clientWidth),
						programWraps: mobile
							? cards[0]?.querySelector('.student-card-program .program-value').scrollWidth <= cards[0]?.querySelector('.student-card-program .program-value').clientWidth
							: [...table.querySelectorAll('.program-value')].every(program => program.scrollWidth <= program.clientWidth),
						tableColumns: desktopVisible && table.querySelectorAll('thead th').length === 5 &&
							[...table.querySelectorAll('thead th')].map(th => th.textContent.trim()).join('|') === 'Student|Program|Status|Registered|Actions',
						actionSizing: !!primary && !!more && Math.abs(primary.width - 88) < 1 && Math.abs(more.width - 40) < 1 &&
							Math.abs(more.left - primary.right - 12) < 1 && Math.abs(primary.height - more.height) < 1,
						pageOverflow: document.documentElement.scrollWidth > innerWidth
					};
				})()`);
				assert(records.cardsComplete === records.mobile, `Student mobile records preserve all details at ${width}`);
				assert(records.emailWraps, `Student long email fits its card at ${width}`);
				assert(records.programWraps, `Student long program name wraps at ${width}`);
				assert(records.tableColumns === !records.mobile, `Student desktop table shows exactly five columns at ${width}`);
				assert(records.actionSizing, `Student View/menu controls use the requested dimensions and 12px gap at ${width}`);
				assert(!records.pageOverflow, `Student records do not cause page overflow at ${width}`);
			}
			const layout = await evaluate(`(() => {
				const groups = [...document.querySelectorAll('.action-buttons')].filter(group => group.getClientRects().length);
				return { pageOverflow: document.documentElement.scrollWidth > innerWidth,
					columnWidths: [...document.querySelectorAll('.actions-header')].filter(cell => cell.getClientRects().length).map(cell => cell.getBoundingClientRect().width),
					groups: groups.map(group => {
						const primary = group.querySelector('.ui-button').getBoundingClientRect(), more = group.querySelector('.row-menu-trigger').getBoundingClientRect();
						const cell = group.closest('td')?.getBoundingClientRect();
						return { height: primary.height, moreHeight: more.height, gap: more.left - primary.right, top: primary.top - more.top,
							fits: !cell || (primary.left >= cell.left && more.right <= cell.right),
							aligned: !cell || Math.abs(more.right - cell.right + 14) < 1 };
					}) };
			})()`);
			assert(!layout.pageOverflow, `${view} ${width}: page overflow`);
			assert(layout.columnWidths.every(value => Math.abs(value - 180) < 1), `${view} ${width}: column widths ${layout.columnWidths}`);
			const expectedGap = view === 'students' ? 12 : 8;
			assert(layout.groups.every(group => group.height === group.moreHeight && group.gap === expectedGap && group.top === 0 && group.fits && group.aligned && group.height === (width < 768 ? 44 : 40)), `${view} ${width}: action alignment ${JSON.stringify(layout.groups)}`);
			await mouseClick('.row-menu-trigger');
			await waitFor("document.querySelector('.row-menu-panel:popover-open') && [...document.querySelectorAll('.row-menu-trigger')].find(item => item.getClientRects().length).getAttribute('aria-expanded') === 'true'");
			await mouseClick('.row-menu-trigger');
			await waitFor("!document.querySelector('.row-menu-panel:popover-open') && [...document.querySelectorAll('.row-menu-trigger')].find(item => item.getClientRects().length).getAttribute('aria-expanded') === 'false'");
			await mouseClick('.row-menu-trigger');
			await waitFor("!!document.querySelector('.row-menu-panel:popover-open')");
			await mouseClick('h1');
			await waitFor("!document.querySelector('.row-menu-panel:popover-open')");
			await mouseClick('.row-menu-trigger');
			await waitFor("!!document.querySelector('.row-menu-panel:popover-open')");
			await mouseClick('.row-menu-trigger', 1);
			await waitFor("document.querySelectorAll('.row-menu-panel:popover-open').length === 1");
			assert.equal(await evaluate("document.querySelectorAll('.row-menu-trigger[aria-expanded=true]').length"), 1, `${view} ${width}: opening another action menu closes the first`);
			await key('Escape');
			await waitFor("!document.querySelector('.row-menu-panel:popover-open')");
			for (const index of [0, 4, 8]) {
				await openRow(index); await assertMenu(`${view} ${width} row ${index}`); menuChecks++;
				await key('Escape');
				await waitFor("!document.querySelector('.row-menu-panel:popover-open')");
				assert(await evaluate('document.activeElement === qaTrigger'), 'Escape restores trigger focus');
			}
		}
	}
	console.log(`Passed ${menuChecks} first/middle/last-row menus across 10 widths; consistent columns, controls and no page/menu overflow.`);
	await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 800, deviceScaleFactor: 1, mobile: false });
	await load('students', 'Staff'); await openRow(0);
	assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=menuitem]')].filter(item => item.getAttribute('aria-disabled') === 'true').map(item => item.textContent.trim())"), ['Revoke verificationAdmin access required', 'DeleteAdmin access required']);
	await evaluate("document.querySelector('[aria-disabled=true][role=menuitem]').click()");
	assert(await evaluate("!!document.querySelector('.row-menu-panel:popover-open') && !document.querySelector('[role=dialog]')"));
	await key('Escape');
	await load('staff'); await openRow(0);
	assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=menuitem]')].map(item => item.textContent.trim())"), ['Edit'], 'Own staff account cannot be deleted from its row menu');
	await key('Escape'); await openRow(4);
	await evaluate("document.querySelector('[role=menuitem]').click()");
	await waitFor("!!document.querySelector('[role=dialog]') && !document.querySelector('.row-menu-panel:popover-open')");
	await load('staff');
	await evaluate("document.querySelector('.staff-directory-header .ui-button').click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Invite Staff Member')");
	await key('Escape');
	await waitFor("!document.querySelector('[role=dialog]')");
	await load('students'); await openRow(0);
	await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent === 'Edit details').click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Edit Student')");
	await load('students');
	await evaluate("[...document.querySelectorAll('.action-buttons .ui-button')].find(button => button.getClientRects().length).click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('View student ID')");
	await load('students'); await openRow(0);
	await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent === 'Revoke verification').click()");
	await waitFor("!!document.querySelector('[role=dialog]')");
	await load('students'); await openRow(4);
	await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent === 'Delete').click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Delete student')");
	await load('requests');
	await evaluate("[...document.querySelectorAll('.action-buttons a')].find(link => link.getClientRects().length).click()");
	assert.equal(await evaluate('window.fixtureNavigation'), '/staff/requests/QA-REQ-1');
	await openRow(0); assert.equal(await evaluate("document.querySelectorAll('[role=menuitem][aria-disabled=true]').length"), 1);
	await evaluate("document.querySelector('[role=menuitem][aria-disabled=true]').click()");
	assert(await evaluate("!!document.querySelector('.row-menu-panel:popover-open')"));
	await evaluate("document.querySelector('[role=menuitem]').click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Are you sure you want to cancel this document request?')");
	assert(await evaluate("[...document.querySelectorAll('[role=dialog] button')].some(button => button.textContent.trim() === 'Keep Request')"));
	await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(button => button.textContent.trim() === 'Confirm Cancellation').click()");
	await waitFor("!document.querySelector('[role=dialog]') && window.fixtureLifecycle?.action === 'cancel'");
	assert(await evaluate("document.querySelector('.request-table-wrap tbody tr .status-chip')?.textContent.includes('Cancelled')"));
	await openRow(2);
	await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent === 'Archive').click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Are you sure you want to archive this request?')");
	await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(button => button.textContent.trim() === 'Confirm Archive').click()");
	await waitFor("!document.querySelector('[role=dialog]') && window.fixtureLifecycle?.action === 'archive'");
	assert.equal(await evaluate("document.querySelectorAll('.request-table-wrap tbody tr').length"), 8);
	await load('requests'); await openRow(0);
	await evaluate("window.fixtureFailAction = true; document.querySelector('[role=menuitem]').click()");
	await waitFor("!!document.querySelector('[role=dialog]')");
	await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(button => button.textContent.trim() === 'Confirm Cancellation').click()");
	await waitFor("document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('Could not save request')");
	assert(await evaluate("!document.querySelector('.request-table-wrap tbody tr .status-chip')?.textContent.includes('Cancelled')"));
	console.log('Passed staff/student edit, view, delete/revoke dialogs, request Review links and disabled permission guards using fake data.');
	await load('keyboard');
	await evaluate("document.querySelector('[aria-label=\"Keyboard sample\"]').focus()");
	await key('ArrowUp'); await waitFor("document.activeElement?.textContent === 'Edit'");
	await key('Home'); assert.equal(await evaluate('document.activeElement.textContent'), 'View');
	await key('ArrowDown'); await key('Enter');
	assert.equal(await evaluate("document.querySelector('output').textContent"), '');
	await key('End'); await key(' '); await waitFor("document.querySelector('output').textContent === 'Edit'");
	await evaluate("document.querySelector('[aria-label=\"Keyboard sample\"]').focus()");
	await key('ArrowDown'); await key('e'); await waitFor("document.activeElement?.textContent === 'Edit'");
	await key('Escape'); await key('ArrowDown'); await waitFor("document.activeElement?.textContent === 'View'"); await key('Enter');
	await waitFor("document.querySelector('output').textContent === 'View'");
	await key('ArrowDown'); await key('Tab'); await waitFor("document.activeElement?.id === 'after-menu'");
	await evaluate("document.querySelector('[aria-label=\"Keyboard sample\"]').click()");
	await key('Tab', 8); await waitFor("document.activeElement?.id === 'before-menu'");
	await evaluate("document.querySelector('[aria-label=\"Keyboard sample\"]').click()");
	await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: 10, y: 10, button: 'left', clickCount: 1 });
	await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 10, y: 10, button: 'left', clickCount: 1 });
	await waitFor("!document.querySelector('.row-menu-panel:popover-open') && document.querySelector('[aria-label=\"Keyboard sample\"]').getAttribute('aria-expanded') === 'false'");
	await evaluate("document.querySelector('[aria-label=\"Keyboard sample\"]').click()");
	await evaluate("document.querySelector('.user-menu-trigger').click()");
	await waitFor("document.querySelectorAll('.row-menu-panel:popover-open').length === 1 && document.querySelector('[aria-label=\"Keyboard sample\"]').getAttribute('aria-expanded') === 'false'");
	await assertMenu('User menu preferred above with fallback');
	await key('Escape');
	await load('students');
	await evaluate("window.scrollTo(0, document.body.scrollHeight)");
	await openRow(8);
	await evaluate("window.scrollTo(0, document.body.scrollHeight)");
	await waitFor("document.querySelector('.row-menu-panel').getBoundingClientRect().bottom <= qaTrigger.getBoundingClientRect().top");
	await assertMenu('Flips above at viewport bottom');
	await key('Escape');
	await evaluate("document.querySelector('.portal-main').style.paddingBottom = '900px'; window.scrollTo(0, 0)");
	await openRow(0);
	await evaluate("qaTrigger.scrollIntoView({block: 'start'})");
	await waitFor("document.querySelector('.row-menu-panel').getBoundingClientRect().top >= qaTrigger.getBoundingClientRect().bottom");
	await assertMenu('Flips below at viewport top');
	await key('Escape');
	await command('Emulation.setDeviceMetricsOverride', { width: 320, height: 480, deviceScaleFactor: 1, mobile: true });
	await command('Emulation.setTouchEmulationEnabled', { enabled: true });
	await loadRevision('pagination');
	await waitFor("!!document.querySelector('.pagination-page')");
	assert(await evaluate("(() => { const controls = [...document.querySelectorAll('.pagination-page, .pagination-arrow, .pagination-size')]; return controls.every(control => control.getBoundingClientRect().width >= 44 && control.getBoundingClientRect().height >= 44); })()"), 'Pagination controls meet touch sizing');
	await evaluate("document.querySelector('.pagination-page[aria-label=\"Page 3\"]').click()");
	assert.equal(await evaluate("document.querySelector('output').textContent"), 'page:3', 'Touch-sized pagination still responds to selection');
	await load('requests');
	const touchPoint = await evaluate("(() => { const trigger = [...document.querySelectorAll('.row-menu-trigger')].find(item => item.getClientRects().length); const rect = trigger.getBoundingClientRect(); return {x:rect.left + rect.width / 2,y:rect.top + rect.height / 2}; })()");
	await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{...touchPoint, radiusX: 5, radiusY: 5, force: 1}] });
	await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await waitFor("!!document.querySelector('.row-menu-panel:popover-open')");
	await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{...touchPoint, radiusX: 5, radiusY: 5, force: 1}] });
	await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await waitFor("!document.querySelector('.row-menu-panel:popover-open') && [...document.querySelectorAll('.row-menu-trigger')].find(item => item.getClientRects().length).getAttribute('aria-expanded') === 'false'");
	await load('keyboard');
	await evaluate("document.querySelector('[aria-label=\"Keyboard sample\"]').click()");
	await assertMenu('Mobile long disabled reason');
	await key('Escape'); await load('students'); await openRow(8);
	await evaluate('window.scrollBy(0, -70)'); await assertMenu('Repositions on scroll');
	await command('Emulation.setDeviceMetricsOverride', { width: 375, height: 640, deviceScaleFactor: 1, mobile: true });
	await assertMenu('Repositions on resize');
	fs.writeFileSync(path.join(output, 'students-mobile.png'), Buffer.from((await command('Page.captureScreenshot')).data, 'base64'));
	await key('Escape');
	await command('Emulation.setTouchEmulationEnabled', { enabled: false });
	await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 800, deviceScaleFactor: 1, mobile: false });
	await load('students');
	await evaluate("document.querySelector('.student-table-wrap').style.overflow = 'hidden'; document.querySelectorAll('tbody tr')[8].querySelector('.row-menu-trigger').scrollIntoView({block:'center'})");
	await openRow(8); await assertMenu('Escapes clipped table container');
	fs.writeFileSync(path.join(output, 'students-desktop.png'), Buffer.from((await command('Page.captureScreenshot')).data, 'base64'));
	}
	async function loadRevision(view) {
		const run = String(Date.now()) + Math.random();
		await command('Page.navigate', {url:`${origin}/qa/fixtures/action-menus/index.html?view=${view}&run=${run}`});
		await waitFor(`window.fixtureRun === ${JSON.stringify(run)} && ` + (view === 'login' ? "!!document.querySelector('.system-title')" : `document.querySelector('h1')?.textContent === ${JSON.stringify(view)}`));
		await evaluate('document.fonts.ready');
	}
	for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
		await command('Emulation.setDeviceMetricsOverride', {width,height:focusedStudentEdit ? 640 : 900,deviceScaleFactor:1,mobile:false});
		if (focusedStudentEdit) {
			await load('students');
			await openRow(0);
			await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Edit details').click()");
			await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Edit Student') && !!document.querySelector('#edit-student-form')");
			const modal = await evaluate(`(() => {
				const panel = document.querySelector('.edit-student-modal');
				const header = panel.querySelector('.modal-header').getBoundingClientRect();
				const body = panel.querySelector('.modal-body');
				const bodyRect = body.getBoundingClientRect();
				const footer = panel.querySelector('.modal-footer');
				const footerRect = footer.getBoundingClientRect();
				const nameColumns = getComputedStyle(panel.querySelector('.edit-student-name-grid')).gridTemplateColumns.split(' ').length;
				const controls = [...panel.querySelectorAll('#edit-student-form input:not([type=checkbox]), #edit-student-form select')];
				return {
					headerBelow: header.bottom <= bodyRect.top,
					footerBelow: footerRect.top >= bodyRect.bottom && footerRect.bottom <= innerHeight,
					scrollableBody: body.scrollHeight > body.clientHeight,
					nameColumns,
					expectedColumns: innerWidth < 768 ? 1 : 2,
					controlWidthsFit: controls.every(control => control.getBoundingClientRect().width <= body.clientWidth),
					email: panel.querySelector('#edit-student-email').value,
					program: panel.querySelector('#edit-student-program').value,
					allLabelsAssociated: [...panel.querySelectorAll('#edit-student-form label[for]')].every(label => !!panel.querySelector('#' + CSS.escape(label.htmlFor))),
					fieldHeights: controls.map(control => control.getBoundingClientRect().height),
					footerButtonHeights: [...footer.querySelectorAll('.ui-button')].map(button => button.getBoundingClientRect().height),
					panelFits: panel.getBoundingClientRect().left >= 0 && panel.getBoundingClientRect().right <= innerWidth &&
						panel.getBoundingClientRect().top >= 0 && panel.getBoundingClientRect().bottom <= innerHeight,
					pageOverflow: document.documentElement.scrollWidth > innerWidth
				};
			})()`);
			assert(modal.headerBelow && modal.footerBelow, `Edit modal header and footer stay outside the scrollable body at ${width}: ${JSON.stringify(modal)}`);
			assert(modal.scrollableBody && modal.panelFits, `Edit modal scrolls within the viewport at ${width}: ${JSON.stringify(modal)}`);
			assert(modal.nameColumns === modal.expectedColumns, `Edit modal uses responsive form columns at ${width}: ${modal.nameColumns}`);
			assert(modal.controlWidthsFit && modal.allLabelsAssociated && modal.fieldHeights.every(height => height === 44),
				`Edit modal fields remain aligned and accessible at ${width}: ${JSON.stringify(modal)}`);
			assert(modal.email === 'a-very-long-student-email-address-for-responsive-layout-checks@example.invalid' &&
				modal.program === 'Master of Science in Hospitality Management and Sustainable Tourism',
				`Long email and program values remain editable at ${width}`);
			assert(modal.footerButtonHeights.length === 2 && modal.footerButtonHeights.every(height => height === 44),
				`Edit modal footer actions have consistent touch-friendly heights at ${width}`);
			assert(!modal.pageOverflow, `Edit modal does not cause horizontal page overflow at ${width}`);
			const scroll = await evaluate(`(() => {
				const panel = document.querySelector('.edit-student-modal');
				const body = panel.querySelector('.modal-body'), footer = panel.querySelector('.modal-footer');
				const initialFooterTop = footer.getBoundingClientRect().top;
				body.scrollTop = body.scrollHeight;
				const last = panel.querySelector('#edit-student-form .edit-student-verified').getBoundingClientRect();
				return { lastControlReachable: last.top >= body.getBoundingClientRect().top && last.bottom <= body.getBoundingClientRect().bottom,
					footerStaysVisible: footer.getBoundingClientRect().top === initialFooterTop && footer.getBoundingClientRect().bottom <= innerHeight };
			})()`);
			assert(scroll.lastControlReachable && scroll.footerStaysVisible, `Last field remains reachable without covering the footer at ${width}`);
			await key('Escape');
			await waitFor("!document.querySelector('[role=dialog]')");
			await openRow(0);
			await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Edit details').click()");
			await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Edit Student')");
			await mouseClick('.edit-student-modal .edit-student-cancel');
			await waitFor("!document.querySelector('[role=dialog]')");
			continue;
		}
		if (focusedDocumentPreview) {
			await loadRevision('documents-admin');
			await waitFor("!!document.querySelector('.document-template-actions .ui-button')");
			await evaluate("window.fixtureDownload = null; [...document.querySelectorAll('.document-template-actions .ui-button')].find(button => button.textContent.trim() === 'View').click()");
			await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('A preview is not available for this file format.')");
			assert(await evaluate("!!document.querySelector('[role=dialog]') && !![...document.querySelectorAll('[role=dialog] .ui-button')].find(button => button.textContent.trim() === 'Download') && window.fixtureDownload === null && !document.querySelector('.row-menu-panel:popover-open')"),
				`DOCX View stays in the preview modal without starting a download at ${width}`);
			assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Documents preview modal does not cause overflow at ${width}`);
			await key('Escape');
			await waitFor("!document.querySelector('[role=dialog]')");
			continue;
		}
		await loadRevision('request-wizard');
		const selectionStart = await evaluate(`(() => {
			const cards = [...document.querySelectorAll('.ui-document-option')];
			const last = cards.at(-1), footer = document.querySelector('.wizard-action-bar');
			return {
				cardCount: cards.length,
				initialCount: document.querySelector('.document-selection-count')?.textContent.trim(),
				oneBorder: cards.every(card => getComputedStyle(card).borderTopWidth === '1px'),
				titleWraps: !!last && last.querySelector('.document-option-title').scrollWidth <= last.querySelector('.document-option-title').clientWidth,
				requirementsShown: cards[0]?.textContent.includes('Clearance Form') && cards[1]?.textContent.includes('Valid ID'),
				footerBelowCards: !!footer && footer.getBoundingClientRect().top >= cards.at(-1).getBoundingClientRect().bottom,
				stepActive: document.querySelector('.ui-stepper li[aria-current="step"] .step-label')?.textContent.trim(),
				pageOverflow: document.documentElement.scrollWidth > innerWidth
			};
		})()`);
		assert.equal(selectionStart.initialCount, '0 of 5 selected', `Selection count starts at zero at ${width}`);
		assert.equal(selectionStart.stepActive, 'Select Document', `Step 1 is active in the shared stepper at ${width}`);
		assert(selectionStart.cardCount === 6 && selectionStart.oneBorder && selectionStart.titleWraps && selectionStart.requirementsShown && selectionStart.footerBelowCards && !selectionStart.pageOverflow,
			`Step 1 cards and footer fit at ${width}: ${JSON.stringify(selectionStart)}`);
		await evaluate("document.querySelector('.ui-document-option label').click()");
		await waitFor("document.querySelector('.document-selection-count')?.textContent.trim() === '1 of 5 selected'");
		await evaluate("[...document.querySelectorAll('.ui-document-option input[type=checkbox]')].filter(input => !input.checked).forEach(input => input.click())");
		const selectionEnd = await evaluate(`(() => {
			const cards = [...document.querySelectorAll('.ui-document-option')];
			const selected = cards.filter(card => card.querySelector('input[type=checkbox]').checked);
			return {
				count: document.querySelector('.document-selection-count')?.textContent.trim(),
				selectedCount: selected.length,
				selectedConsistent: selected.every(card => card.classList.contains('is-selected')),
				selectedSingleBorder: selected.every(card => getComputedStyle(card).borderTopWidth === '1px' && getComputedStyle(card).boxShadow === 'none'),
				noDuplicateCheck: selected.every(card => !card.querySelector('.fa-circle-check')),
				limitDisabled: cards.at(-1).querySelector('input[type=checkbox]').disabled,
				footerClear: document.querySelector('.wizard-action-bar').getBoundingClientRect().top >= cards.at(-1).getBoundingClientRect().bottom,
				pageOverflow: document.documentElement.scrollWidth > innerWidth
			};
		})()`);
		assert(selectionEnd.count === '5 of 5 selected' && selectionEnd.selectedCount === 5 && selectionEnd.selectedConsistent && selectionEnd.selectedSingleBorder &&
			selectionEnd.noDuplicateCheck && selectionEnd.limitDisabled && selectionEnd.footerClear && !selectionEnd.pageOverflow,
			`Step 1 enforces the cap and keeps selection visuals clear at ${width}: ${JSON.stringify(selectionEnd)}`);
		await evaluate("[...document.querySelectorAll('.wizard-action-bar .ui-button')].find(button => button.textContent.trim() === 'Next').click()");
		await waitFor("document.body.innerText.includes('Submit Requirements') && document.querySelectorAll('.wizard-requirement').length === 2");
		assert(await evaluate("document.querySelector('.ui-stepper li[aria-current=\"step\"] .step-label')?.textContent.trim() === 'Submit Requirements'"), `Step 2 is active in the shared stepper at ${width}`);
		assert(await evaluate("(() => { const clearance = [...document.querySelectorAll('.wizard-requirement')].find(card => card.getAttribute('aria-label') === 'Clearance Form'); const needed = clearance?.querySelector('.requirement-needed-for')?.textContent ?? ''; const progress = document.querySelector('.wizard-progress-track'); return needed.includes('Certificate of Enrollment') && needed.includes('Comprehensive Exam Certificate') && progress?.getAttribute('aria-valuemax') === '2' && progress.getAttribute('aria-valuenow') === '0' && !!clearance?.querySelector('[aria-label=\"File status: Missing\"]') && !document.body.innerText.includes('Download form'); })()"), `Wizard keeps shared requirements unique with accurate initial progress at ${width}`);
		const wizardLayout = await evaluate("(() => { const cards = [...document.querySelectorAll('.wizard-requirement')], picker = cards[0]?.querySelector('.picker-row'), footer = document.querySelector('.wizard-action-bar'), buttons = [...footer.querySelectorAll('.ui-button')].map(button => button.getBoundingClientRect()); return { overflow: document.documentElement.scrollWidth > innerWidth, cardCount: cards.length, pickerWidth: picker?.getBoundingClientRect().width, cardWidth: cards[0]?.getBoundingClientRect().width, buttonsSameHeight: buttons.length === 2 && buttons[0].height === buttons[1].height, buttonsSameRow: buttons.length === 2 && Math.abs(buttons[0].top - buttons[1].top) < 1 }; })()");
		assert(wizardLayout.cardCount === 2 && wizardLayout.pickerWidth <= wizardLayout.cardWidth && wizardLayout.buttonsSameHeight && wizardLayout.buttonsSameRow && !wizardLayout.overflow, `Wizard requirement and navigation layout at ${width}: ${JSON.stringify(wizardLayout)}`);
		await evaluate("(() => { const input = document.querySelector('.wizard-requirement input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(new File(['valid sample'], 'clearance.jpg', {type:'image/jpeg'})); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()");
		await waitFor("document.querySelector('.wizard-progress-track')?.getAttribute('aria-valuenow') === '1'");
		assert(await evaluate("document.body.innerText.includes('1 of 2 required files selected') && document.body.innerText.includes('1 remaining') && document.querySelector('.wizard-requirement [aria-label=\"File status: Selected\"]') && document.body.innerText.includes('clearance.jpg') && !document.body.innerText.includes('Uploaded')"), `Wizard selected-file state is not reported as uploaded at ${width}`);
		await evaluate("(() => { const input = [...document.querySelectorAll('.wizard-requirement input[type=file]')][1]; const transfer = new DataTransfer(); transfer.items.add(new File(['valid sample'], 'id.jpg', {type:'image/jpeg'})); input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles:true})); })()");
		await waitFor("document.querySelector('.wizard-progress-track')?.getAttribute('aria-valuenow') === '2'");
		assert(await evaluate("!document.querySelector('.wizard-action-bar .wizard-next-button').disabled"), `Wizard enables Next after all requirement files are selected at ${width}`);
		await evaluate("document.querySelector('.wizard-action-bar .wizard-next-button').click()");
		await waitFor("document.querySelector('.ui-stepper li[aria-current=\"step\"] .step-label')?.textContent.trim() === 'Review & Submit'");
		if (focusedRequestWizard) continue;
		await loadRevision('login');
		assert(await evaluate(`(() => {
			const title = document.querySelector('.system-title'), tagline = document.querySelector('.story-copy h2');
			return title.previousElementSibling === tagline && title.getBoundingClientRect().top >= tagline.getBoundingClientRect().bottom && document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.login-story p,.login-story strong')].filter(node => node.textContent === 'ESSU DocuFlow').length === 1;
		})()`), `Login title at ${width}`);
		await evaluate("document.querySelector('.login-switch-card').click()");
		await waitFor("!!document.querySelector('[role=combobox][aria-label=\"Program or course\"]')");
		await evaluate("window.qaSelect = document.querySelector('[role=combobox][aria-label=\"Program or course\"]'); qaSelect.scrollIntoView({block:'center'}); qaSelect.focus()");
		await key('ArrowDown');
		await waitFor("!!document.querySelector('.select-listbox:popover-open')");
		assert(await evaluate("(() => { const list = document.querySelector('.select-listbox'), rect = list.getBoundingClientRect(); return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight && rect.width <= qaSelect.getBoundingClientRect().width; })()"), `Registration listbox fits the viewport at ${width}`);
		await key('Escape');
		await waitFor("!document.querySelector('.select-listbox:popover-open') && qaSelect.getAttribute('aria-expanded') === 'false'");
		await evaluate("qaSelect.click()");
		await waitFor("!!document.querySelector('.select-listbox:popover-open')");
		await key('ArrowDown'); await key('Enter');
		assert(await evaluate("qaSelect.getAttribute('aria-expanded') === 'false' && !qaSelect.textContent.includes('Select your program')"), `Registration listbox keyboard selection at ${width}`);
		assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Registration dropdown has no horizontal page overflow at ${width}`);
		await loadRevision('pagination');
		await waitFor("!!document.querySelector('.pagination-page[aria-label=\"Page 3\"]')");
		await evaluate("document.querySelector('.pagination-page[aria-label=\"Page 3\"]').click()");
		assert.equal(await evaluate("document.querySelector('output').textContent"), 'page:3', `Pagination invokes the requested page at ${width}`);
		await evaluate("const size = document.querySelector('.pagination-size'); size.value = '25'; size.dispatchEvent(new Event('change', {bubbles:true}))");
		assert.equal(await evaluate("document.querySelector('output').textContent"), 'size:25', `Pagination size invokes its callback at ${width}`);
		assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `Pagination has no horizontal overflow at ${width}`);
		await loadRevision('requests');
		await waitFor("!!document.querySelector('[title=\"Show all documents\"]')");
		await evaluate("window.qaDocumentTrigger = document.querySelector('[title=\"Show all documents\"]'); qaDocumentTrigger.click()");
		await waitFor("!!document.querySelector('.document-popover:popover-open')");
		assert(await evaluate("(() => { const panel = document.querySelector('.document-popover'), rect = panel.getBoundingClientRect(); return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight && panel.getAttribute('role') === 'dialog'; })()"), `Request document details fit the viewport at ${width}`);
		await key('Escape');
		await waitFor("!document.querySelector('.document-popover:popover-open') && qaDocumentTrigger.getAttribute('aria-expanded') === 'false'");
		await openRow(0);
		await evaluate("qaDocumentTrigger.click()");
		await waitFor("!!document.querySelector('.document-popover:popover-open') && !document.querySelector('.row-menu-panel:popover-open')");
		assert.equal(await evaluate("document.querySelectorAll('[popover]:popover-open').length"), 1, 'Only one auto popover is open on the page');
		await key('Escape');
		await waitFor("!document.querySelector('.document-popover:popover-open')");
		await evaluate("qaDocumentTrigger.click()");
		await waitFor("!!document.querySelector('.document-popover:popover-open')");
		await evaluate("document.querySelector('h1').click()");
		await waitFor("!document.querySelector('.document-popover:popover-open')");
		await loadRevision('documents');
		await waitFor("!document.body.innerText.includes('Loading document details')");
		await evaluate("window.fixturePreviewDelay = 300; [...document.querySelectorAll('.request-header .ui-button')].find(button => button.textContent.trim() === 'View').click()");
		await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Loading document preview')");
		await waitFor("!!document.querySelector('[role=dialog] .pdf-viewer canvas')");
		assert(await evaluate("(() => { const dialog = document.querySelector('[role=dialog]'), viewer = dialog.querySelector('.pdf-viewer'), canvas = viewer.querySelector('canvas'); return !viewer.querySelector('iframe,embed,object') && canvas.getBoundingClientRect().width <= viewer.clientWidth && viewer.scrollHeight >= viewer.clientHeight; })()"), 'Document PDF uses the in-app PDF.js viewer without native embed UI');
		await key('Escape');
		await evaluate("[...document.querySelectorAll('.request-header .ui-button')].find(button => button.textContent.trim() === 'Download document').click()");
		await waitFor("window.fixtureDownload === 'Enrollment.pdf'");
		await evaluate("window.fixtureFailPreview = true; [...document.querySelectorAll('.request-header .ui-button')].find(button => button.textContent.trim() === 'View').click()");
		await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Document unavailable')");
		await key('Escape');
		await loadRevision('forms'); await waitFor("!!document.querySelector('.form-library-card')");
		await evaluate("(() => { const input = document.querySelector('.library-search input'); input.value = 'no matching form'; input.dispatchEvent(new Event('input', {bubbles:true})); })()");
		await waitFor("document.body.innerText.includes('No forms found')");
		await evaluate("(() => { const input = document.querySelector('.library-search input'); input.value = ''; input.dispatchEvent(new Event('input', {bubbles:true})); const category = document.querySelector('.library-category-filter select'); category.value = 'Prospectus'; category.dispatchEvent(new Event('change', {bubbles:true})); })()");
		await waitFor("!!document.querySelector('.form-library-card')");
		assert(await evaluate("document.querySelectorAll('.form-library-card').length === 1 && (() => { const search = document.querySelector('.library-search input').getBoundingClientRect(), category = document.querySelector('.library-category-filter select').getBoundingClientRect(); return search.height === 48 && category.height === 48 && document.documentElement.scrollWidth <= innerWidth; })()"), `Forms search and category filters remain responsive at ${width}`);
		await evaluate("document.querySelector('.library-category-filter select').value = 'All categories'; document.querySelector('.library-category-filter select').dispatchEvent(new Event('change', {bubbles:true}))");
		await waitFor("!!document.querySelector('.form-library-card')");
		assert(await evaluate("(() => { const actions = [...document.querySelectorAll('.library-primary-actions .ui-button, .library-primary-actions .row-menu-trigger')]; const rects = actions.map(button => button.getBoundingClientRect()); return !document.querySelector('.library-meta, .library-format-list, .library-file-type') && rects.length === 2 && Math.abs(rects[0].width - rects[1].width) < 1 && rects.every(rect => rect.height === 44 && Math.abs(rect.top - rects[0].top) < 1) && document.querySelector('.library-view-button').getAttribute('aria-label') === 'View PDF' && document.querySelectorAll('.library-management-trigger').length === 0; })()"), `Student form cards keep View/Download aligned at 44px at ${width}`);
		await evaluate("document.querySelector('.library-download-trigger').click()");
		await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Download PDF').click()");
		await waitFor("window.fixtureDownload?.endsWith('.pdf')");
		await evaluate("document.querySelector('.library-download-trigger').click()");
		assert(await evaluate("![...document.querySelectorAll('[role=menuitem]')].some(item => item.textContent.includes('DOCX'))"), 'Student download options do not expose editable DOCX files');
		await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Download Preview PDF').click()");
		await waitFor("window.fixtureDownload?.endsWith('.pdf')");
		await evaluate("document.querySelector('.library-view-button').click()");
		await waitFor("!!document.querySelector('[role=dialog] .pdf-viewer canvas')");
		await waitFor("!!document.querySelector('[role=dialog] .pdf-page[data-pdf-page=\"2\"] canvas')");
		assert(await evaluate("document.querySelectorAll('[role=dialog] .pdf-page').length === 2 && document.querySelector('[role=dialog] .pdf-viewer').scrollHeight > document.querySelector('[role=dialog] .pdf-viewer').clientHeight"), 'PDF.js renders scrollable pages directly in the modal');
		assert(await evaluate("(() => { const dialog = document.querySelector('[role=dialog]'), viewer = dialog.querySelector('.pdf-viewer'), canvas = viewer.querySelector('canvas'); return !!dialog.querySelector('h2') && !!dialog.querySelector('[aria-label=\"Close modal\"]') && !viewer.querySelector('iframe,embed,object') && canvas.getBoundingClientRect().width <= viewer.clientWidth; })()"), 'PDF pages fit the modal without using the native browser viewer');
		assert(await evaluate("window.fixtureCalls.some(call => call.url === '/api/forms/4/download?preview=1')"), 'View requests the PDF preview endpoint');
		await key('Escape');
		await evaluate("window.fixtureMissingPdf = true; document.querySelector('.library-view-button').click()");
		await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('PDF preview is unavailable.')");
		assert(await evaluate("!document.querySelector('[role=dialog] iframe')"), 'A missing PDF preview does not display the DOCX file');
		await key('Escape');
		await evaluate("window.fixtureMissingPdf = false");
		await loadRevision('forms-admin'); await waitFor("!!document.querySelector('.form-library-card')");
		assert(await evaluate("document.querySelector('.page-toolbar')?.textContent.includes('Official forms library') && [...document.querySelectorAll('.page-toolbar .ui-button')].some(button => button.textContent.includes('Add form'))"), 'Admin Forms toolbar retains its heading and Add Form action');
		assert(await evaluate("(() => { const actions = [...document.querySelectorAll('.library-primary-actions .ui-button, .library-primary-actions .row-menu-trigger')]; const rects = actions.map(button => button.getBoundingClientRect()); return actions.length === 3 && rects.every(rect => rect.height === 44 && Math.abs(rect.top - rects[0].top) < 1) && Math.abs(rects[2].width - 44) < 1 && Math.abs(rects[1].left - rects[0].right - 8) < 1 && Math.abs(rects[2].left - rects[1].right - 8) < 1 && document.querySelectorAll('.library-management-trigger').length === 1; })()"), `Admin View/Download/management actions share one 44px row at ${width}`);
		await evaluate("document.querySelector('.library-management-trigger').click()");
		await waitFor("!!document.querySelector('.row-menu-panel:popover-open')");
		assert(await evaluate("[...document.querySelectorAll('[role=menuitem]')].some(item => item.textContent.trim() === 'Edit') && [...document.querySelectorAll('[role=menuitem]')].some(item => item.textContent.trim() === 'Delete') && ![...document.querySelectorAll('[role=menuitem]')].some(item => item.textContent.includes('Download'))"), 'Admin menu retains Edit/Delete and stays separate from downloads');
		await key('Escape');
		await waitFor("!document.querySelector('.row-menu-panel:popover-open')");
		await evaluate("document.querySelector('.library-download-trigger').click()");
		assert(await evaluate("![...document.querySelectorAll('[role=menuitem]')].some(item => ['Edit','Delete'].includes(item.textContent.trim()))"), 'Admin download dropdown excludes management actions');
		await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Download DOCX').click()");
		await waitFor("window.fixtureDownload?.endsWith('.docx')");
		await evaluate("document.querySelector('.library-view-button').click()");
		await waitFor("!!document.querySelector('[role=dialog] .pdf-viewer canvas')");
		await key('Escape');
		assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Forms overflow at ${width}`);
	}
	if (!focusedBrowserFlow) {
		await command('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
		await loadRevision('archived'); await waitFor("!!document.querySelector('.request-table-wrap tbody tr')");
		assert(await evaluate("document.body.innerText.includes('Archived Requests') && document.querySelector('.request-table-wrap .status-chip').textContent.includes('Rejected')"));
		await openRow(0); assert.equal(await evaluate("document.querySelectorAll('[role=menuitem][aria-disabled=true]').length"),2);
		console.log('Passed cancellation/archive confirmation, saved state and failure recovery; login placement and document/form preview/download at mobile, tablet and desktop; archived view retains the original status.');
	} else if (focusedRequestWizard) {
		console.log('Passed request wizard selection, requirement, footer and stepper checks at all configured widths.');
	} else if (focusedStudentEdit) {
		console.log('Passed Edit Student modal layout, scrolling, footer, accessibility and Cancel checks at all configured widths.');
	} else {
		console.log('Passed DOCX View modal behavior without an automatic download at all configured widths.');
	}
	assert.equal(errors.length, 0, JSON.stringify(errors));
	if (!focusedBrowserFlow) console.log('Passed keyboard arrows, Home/End, typeahead, Enter/Space, Tab/Shift+Tab, Escape/focus, outside click, one menu at a time, long labels, touch, scroll/resize and clipped-parent checks.');
} finally {
	socket?.close(); browser.kill(); await server.close();
}
