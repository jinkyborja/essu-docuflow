// Run with: node qa/action-menus.browser.mjs
// Uses installed Vite/Svelte and headless Edge/Chrome, with no QA accounts or extra packages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const root = process.cwd();
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
const server = await createServer({
	configFile: false, root, plugins: [svelte(), tailwindcss()],
	resolve: { alias: { '$lib': path.resolve('src/lib'), '$app/navigation': navigation, '$app/stores': navigation, '$app/environment': navigation } },
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
		for (let index = 0; index < 100; index++) {
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
	async function openRow(index) {
		await evaluate(`(async () => {
			window.qaTrigger = [...document.querySelectorAll('.action-buttons .row-menu-trigger')].filter(button => button.getClientRects().length)[${index}];
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
	for (const width of [320, 375, 767, 768, 1024, 1280, 1440, 1920]) {
		await command('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: false });
		for (const view of ['staff', 'students', 'requests']) {
			await load(view);
			if (view === 'students') {
				await evaluate("window.qaFilterToggle = document.querySelector('.student-filter-toggle'); if (qaFilterToggle?.getClientRects().length) qaFilterToggle.click()");
				await waitFor("!qaFilterToggle?.getClientRects().length || qaFilterToggle.getAttribute('aria-expanded') === 'true'");
				const heights = await evaluate("[...document.querySelectorAll('.student-filter-controls select')].filter(control => control.getClientRects().length).map(control => control.getBoundingClientRect().height)");
				assert(heights.length > 0 && heights.every(height => height >= 44), `Student filters meet touch sizing at ${width}: ${heights}`);
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
			assert(layout.groups.every(group => group.height === group.moreHeight && group.gap === 8 && group.top === 0 && group.fits && group.aligned && group.height === (width < 768 ? 44 : 40)), `${view} ${width}: action alignment ${JSON.stringify(layout.groups)}`);
			for (const index of [0, 4, 8]) {
				await openRow(index); await assertMenu(`${view} ${width} row ${index}`); menuChecks++;
				await key('Escape');
				await waitFor("!document.querySelector('.row-menu-panel:popover-open')");
				assert(await evaluate('document.activeElement === qaTrigger'), 'Escape restores trigger focus');
			}
		}
	}
	console.log(`Passed ${menuChecks} first/middle/last-row menus across 8 widths; consistent columns, controls and no page/menu overflow.`);
	await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 800, deviceScaleFactor: 1, mobile: false });
	await load('students', 'Staff'); await openRow(0);
	assert.deepEqual(await evaluate("[...document.querySelectorAll('[role=menuitem]')].filter(item => item.getAttribute('aria-disabled') === 'true').map(item => item.textContent.trim())"), ['Revoke verificationAdmin access required', 'DeleteAdmin access required']);
	await evaluate("document.querySelector('[aria-disabled=true][role=menuitem]').click()");
	assert(await evaluate("!!document.querySelector('.row-menu-panel:popover-open') && !document.querySelector('[role=dialog]')"));
	await key('Escape');
	await load('staff'); await openRow(0);
	assert.equal(await evaluate("document.querySelector('[role=menuitem]').getAttribute('aria-disabled')"), 'true');
	await key('Escape'); await openRow(4);
	await evaluate("document.querySelector('[role=menuitem]').click()");
	await waitFor("!!document.querySelector('[role=dialog]') && !document.querySelector('.row-menu-panel:popover-open')");
	await load('staff');
	await evaluate("[...document.querySelectorAll('.action-buttons .ui-button')].find(button => button.getClientRects().length).click()");
	await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Edit Staff Member')");
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
	async function loadRevision(view) {
		const run = String(Date.now()) + Math.random();
		await command('Page.navigate', {url:`${origin}/qa/fixtures/action-menus/index.html?view=${view}&run=${run}`});
		await waitFor(`window.fixtureRun === ${JSON.stringify(run)} && ` + (view === 'login' ? "!!document.querySelector('.system-title')" : `document.querySelector('h1')?.textContent === ${JSON.stringify(view)}`));
		await evaluate('document.fonts.ready');
	}
	for (const width of [320, 375, 390, 430, 768, 1440]) {
		await command('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false});
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
		await waitFor("!!document.querySelector('[role=dialog] iframe[src^=blob]')");
		assert(await evaluate("document.querySelector('[role=dialog] iframe').getBoundingClientRect().width <= innerWidth"));
		await key('Escape');
		await evaluate("[...document.querySelectorAll('.request-header .ui-button')].find(button => button.textContent.trim() === 'Download document').click()");
		await waitFor("window.fixtureDownload === 'Enrollment.pdf'");
		await evaluate("window.fixtureFailPreview = true; [...document.querySelectorAll('.request-header .ui-button')].find(button => button.textContent.trim() === 'View').click()");
		await waitFor("document.querySelector('[role=dialog]')?.textContent.includes('Document unavailable')");
		await key('Escape');
		await loadRevision('forms'); await waitFor("!!document.querySelector('.form-library-card')");
		assert(await evaluate("(() => { const actions = [...document.querySelectorAll('.library-primary-actions .ui-button, .library-primary-actions .row-menu-trigger')]; const rects = actions.map(button => button.getBoundingClientRect()); const formats = document.querySelector('.library-format-list').textContent; return formats.includes('PDF') && formats.includes('Preview PDF') && !formats.includes('DOCX') && rects.length === 2 && Math.abs(rects[0].width - rects[1].width) < 1 && Math.abs(rects[0].height - rects[1].height) < 1 && document.querySelectorAll('.library-secondary-actions .row-menu-trigger').length === 0; })()"));
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
		assert(await evaluate("document.querySelectorAll('.library-secondary-actions .row-menu-trigger').length === 1"), 'Admin actions remain in their separate three-dot menu');
		await evaluate("document.querySelector('.library-download-trigger').click()");
		await evaluate("[...document.querySelectorAll('[role=menuitem]')].find(item => item.textContent.trim() === 'Download DOCX').click()");
		await waitFor("window.fixtureDownload?.endsWith('.docx')");
		await evaluate("document.querySelector('.library-view-button').click()");
		await waitFor("!!document.querySelector('[role=dialog] .pdf-viewer canvas')");
		await key('Escape');
		assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), `Forms overflow at ${width}`);
	}
	await command('Emulation.setDeviceMetricsOverride', {width:1440,height:900,deviceScaleFactor:1,mobile:false});
	await loadRevision('archived'); await waitFor("!!document.querySelector('.request-table-wrap tbody tr')");
	assert(await evaluate("document.body.innerText.includes('Archived Requests') && document.querySelector('.request-table-wrap .status-chip').textContent.includes('Rejected')"));
	await openRow(0); assert.equal(await evaluate("document.querySelectorAll('[role=menuitem][aria-disabled=true]').length"),2);
	console.log('Passed cancellation/archive confirmation, saved state and failure recovery; login placement and document/form preview/download at mobile, tablet and desktop; archived view retains the original status.');
	assert.equal(errors.length, 0, JSON.stringify(errors));
	console.log('Passed keyboard arrows, Home/End, typeahead, Enter/Space, Tab/Shift+Tab, Escape/focus, outside click, one menu at a time, long labels, touch, scroll/resize and clipped-parent checks.');
} finally {
	socket?.close(); browser.kill(); await server.close();
}
