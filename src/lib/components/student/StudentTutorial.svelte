<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { showToast } from '$lib/stores/toasts';

	let { userId }: { userId: number } = $props();

	type TutorialStep = {
		title: string;
		description: string;
		href: string;
		target?: string;
		fallback?: string;
		tip?: string;
	};

	const tutorialSteps: TutorialStep[] = [
		{
			title: 'Welcome to ESSU DocuFlow',
			description: 'ESSU DocuFlow helps Graduate School students request academic documents online, submit requirements and follow office updates. This guided tour explains the process without changing your account or creating a request.',
			href: '/student/dashboard'
		},
		{
			title: 'Your Student Dashboard',
			description: 'Your dashboard brings together active requests, recent updates and your next step. Start a request here when your student ID has been verified.',
			href: '/student/dashboard',
			target: 'student-dashboard',
			fallback: 'The Student Dashboard shows active requests, recent updates and the next step for your account.'
		},
		{
			title: 'Start a new request',
			description: 'Choose Request a document to open the request wizard. Requesting is available after the Graduate School verifies your student ID.',
			href: '/student/dashboard',
			target: 'dashboard-new-request',
			fallback: 'Request a document is available after your student ID is verified. While an account is being reviewed, you can browse Forms.'
		},
		{
			title: 'Select Document',
			description: 'Select up to five available documents. Each option lists its requirements so you can see what is needed before continuing.',
			href: '/student/request',
			target: 'request-select-document',
			fallback: 'In the first request step, choose up to five documents and review the requirements listed under each one.',
			tip: 'This is an instructional preview only. The tutorial does not select a document or change your request.'
		},
		{
			title: 'Submit Requirements',
			description: 'Choose a file for every online requirement. Requirements with the same name across selected documents are shared and only need one file. Items marked in person are handled at the Graduate School.',
			href: '/student/request',
			target: 'request-requirements-step',
			fallback: 'The second step lists each distinct requirement. Missing online files are identified before you can continue.',
			tip: 'Accepted files are PDF, JPG, PNG, WebP, HEIC or HEIF, up to 10 MB each. This tutorial never opens a file picker or uploads a file.'
		},
		{
			title: 'Review & Submit',
			description: 'Check your selected documents, purpose and requirement files in the final step. The portal asks you to confirm before submitting.',
			href: '/student/request',
			target: 'request-review-step',
			fallback: 'Before submitting, review the purpose, selected documents and uploaded requirements on the final request step.',
			tip: 'This is a safe walkthrough: it does not submit a request, call a request endpoint or create a database record.'
		},
		{
			title: 'My Documents',
			description: 'Track each request’s status, timeline, requirements and messages from the Graduate School here. If a correction is requested, read the note and replace the flagged file.',
			href: '/student/documents',
			target: 'student-documents',
			fallback: 'My Documents shows request statuses, timelines, requirements and office messages.'
		},
		{
			title: 'Notifications',
			description: 'Request updates and important office messages appear here. Open a notification to read its details and follow its request link.',
			href: '/student/notifications',
			target: 'student-notifications',
			fallback: 'Notifications lists request decisions and office updates. Open an item to see its details.'
		},
		{
			title: 'Help Center',
			description: 'Open Tutorial & Help from Student navigation whenever you need a refresher. The Help Center has request instructions, file guidance, FAQs and a Restart tutorial button.',
			href: '/student/help',
			target: 'student-help-restart',
			fallback: 'Open Tutorial & Help from Student navigation to read the guide or restart this walkthrough.'
		},
		{
			title: 'You’re ready to get started',
			description: 'You can revisit this tutorial at any time from Tutorial & Help. When you are ready to request a document, open Request Document from your dashboard.',
			href: '/student/help'
		}
	];

	const storageKey = $derived(`essu-docuflow:student-tutorial:v1:${userId}`);
	let initialized = $state(false);
	let tutorialCompleted = $state(false);
	let tutorialOpen = $state(false);
	let stepIndex = $state(0);
	let targetMissing = $state(false);
	let navigationError = $state('');
	let activeTarget = $state<HTMLElement | null>(null);
	let tutorialPanel = $state<HTMLElement>();
	let tutorialHeading = $state<HTMLHeadingElement>();
	let spotlightRect = $state<DOMRect | null>(null);
	let panelPosition = $state<{ left: number; top: number } | null>(null);
	let returnFocus: HTMLElement | null = null;
	const activeStep = $derived(tutorialSteps[stepIndex]);
	const isWelcome = $derived(stepIndex === 0);
	const isCompletion = $derived(stepIndex === tutorialSteps.length - 1);

	function startTutorial() {
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		stepIndex = 0;
		targetMissing = false;
		navigationError = '';
		tutorialOpen = true;
	}

	function readCompletion(): boolean {
		try {
			if (localStorage.getItem(storageKey) === 'completed') return true;
		} catch {
			try {
				return sessionStorage.getItem(storageKey) === 'completed';
			} catch {
				showToast('Tutorial preferences could not be read. Your choice will last only until you leave this page.', 'error');
				return false;
			}
		}
		try {
			return sessionStorage.getItem(storageKey) === 'completed';
		} catch {
			showToast('Tutorial preferences could not be read. Your choice will last only until you leave this page.', 'error');
			return false;
		}
	}

	function saveCompletion() {
		tutorialCompleted = true;
		try {
			localStorage.setItem(storageKey, 'completed');
			return;
		} catch {
			try {
				sessionStorage.setItem(storageKey, 'completed');
				showToast('Tutorial choice will be remembered for this browser session only.', 'error');
				return;
			} catch {
				showToast('Tutorial choice could not be saved. It may appear again next time you visit.', 'error');
			}
		}
	}

	function finishTutorial() {
		saveCompletion();
		tutorialOpen = false;
		const focusTarget = returnFocus;
		returnFocus = null;
		void tick().then(() => {
			if (focusTarget?.isConnected) focusTarget.focus();
		});
	}

	function skipWelcome() {
		finishTutorial();
	}

	function updatePanelPosition() {
		if (!tutorialOpen || !tutorialPanel || window.innerWidth <= 767 || !activeTarget) {
			panelPosition = null;
			return;
		}

		const target = activeTarget.getBoundingClientRect();
		const panel = tutorialPanel.getBoundingClientRect();
		const gap = 20;
		const edge = 16;
		const candidates = [
			{ left: target.right + gap, top: target.top },
			{ left: target.left - panel.width - gap, top: target.top },
			{ left: target.left + (target.width - panel.width) / 2, top: target.bottom + gap },
			{ left: target.left + (target.width - panel.width) / 2, top: target.top - panel.height - gap }
		];
		const fits = candidates.find(candidate =>
			candidate.left >= edge &&
			candidate.top >= edge &&
			candidate.left + panel.width <= window.innerWidth - edge &&
			candidate.top + panel.height <= window.innerHeight - edge
		);

		if (fits) {
			panelPosition = fits;
			return;
		}

		const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
		const score = (candidate: { left: number; top: number }) => {
			const left = clamp(candidate.left, edge, window.innerWidth - panel.width - edge);
			const top = clamp(candidate.top, edge, window.innerHeight - panel.height - edge);
			const overlapWidth = Math.max(0, Math.min(left + panel.width, target.right) - Math.max(left, target.left));
			const overlapHeight = Math.max(0, Math.min(top + panel.height, target.bottom) - Math.max(top, target.top));
			return { left, top, overlap: overlapWidth * overlapHeight };
		};
		panelPosition = candidates
			.map(score)
			.sort((a, b) => a.overlap - b.overlap)[0];
	}

	function updateSpotlight() {
		if (!tutorialOpen || !activeTarget?.isConnected) {
			spotlightRect = null;
			panelPosition = null;
			return;
		}
		const rect = activeTarget.getBoundingClientRect();
		spotlightRect = rect.width && rect.height ? rect : null;
		updatePanelPosition();
	}

	async function navigateToStep(index: number) {
		if (index < 0 || index >= tutorialSteps.length) return;
		stepIndex = index;
		targetMissing = false;
		navigationError = '';
		const destination = tutorialSteps[index].href;
		if ($page.url.pathname === destination) return;
		try {
			await goto(destination);
			if ($page.url.pathname !== destination) {
				navigationError = 'Navigation was cancelled. Your current page and any unsaved work have not been changed.';
				targetMissing = true;
				await tick();
				tutorialHeading?.focus({ preventScroll: true });
			}
		} catch (error) {
			navigationError = error instanceof Error ? error.message : 'Could not open this tutorial step.';
			targetMissing = true;
			await tick();
			tutorialHeading?.focus({ preventScroll: true });
			showToast(navigationError, 'error');
		}
	}

	function nextStep() {
		if (isCompletion) finishTutorial();
		else void navigateToStep(stepIndex + 1);
	}

	function previousStep() {
		void navigateToStep(stepIndex - 1);
	}

	function handleTutorialKeydown(event: KeyboardEvent) {
		if (!tutorialOpen) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			finishTutorial();
			return;
		}
		if (event.target instanceof Node && tutorialPanel?.contains(event.target)) {
			if (event.key === 'ArrowRight' && !isCompletion) {
				event.preventDefault();
				nextStep();
				return;
			}
			if (event.key === 'ArrowLeft' && !isWelcome) {
				event.preventDefault();
				previousStep();
				return;
			}
		}
		if (event.key !== 'Tab' || !tutorialPanel) return;
		const focusable = [...tutorialPanel.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'
		)].filter(element => element.getClientRects().length > 0);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) {
			event.preventDefault();
			tutorialPanel.focus();
		} else if (event.shiftKey && (document.activeElement === first || document.activeElement === tutorialPanel)) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && (document.activeElement === last || document.activeElement === tutorialPanel)) {
			event.preventDefault();
			first.focus();
		}
	}

	onMount(() => {
		tutorialCompleted = readCompletion();
		initialized = true;
		const start = () => startTutorial();
		window.addEventListener('student-tutorial:start', start);
		window.addEventListener('resize', updateSpotlight);
		window.addEventListener('scroll', updateSpotlight, true);
		window.visualViewport?.addEventListener('resize', updateSpotlight);
		return () => {
			window.removeEventListener('student-tutorial:start', start);
			window.removeEventListener('resize', updateSpotlight);
			window.removeEventListener('scroll', updateSpotlight, true);
			window.visualViewport?.removeEventListener('resize', updateSpotlight);
		};
	});

	$effect(() => {
		if (initialized && !tutorialCompleted && !tutorialOpen && $page.url.pathname === '/student/dashboard') {
			returnFocus = null;
			stepIndex = 0;
			tutorialOpen = true;
		}
	});

	$effect(() => {
		if (!initialized) return;
		const portal = document.querySelector<HTMLElement>('.student-portal');
		if (!portal) return;
		const wasInert = portal.inert;
		if (tutorialOpen) portal.inert = true;
		return () => {
			if (!wasInert) portal.inert = false;
		};
	});

	$effect(() => {
		if (!tutorialOpen) {
			activeTarget = null;
			spotlightRect = null;
			panelPosition = null;
			return;
		}
		const step = activeStep;
		const route = $page.url.pathname;
		let cancelled = false;
		let observer: ResizeObserver | undefined;
		activeTarget = null;
		spotlightRect = null;
		panelPosition = null;
		targetMissing = false;
		navigationError = '';

		const locateTarget = async () => {
			await tick();
			if (!step.target) {
				await tick();
				if (!cancelled) tutorialHeading?.focus({ preventScroll: true });
				return;
			}
			if (route !== step.href) return;
			await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
			if (cancelled) return;
			const target = [...document.querySelectorAll<HTMLElement>('[data-student-tour]')]
				.find(element => element.dataset.studentTour === step.target);
			if (!target) {
				targetMissing = true;
				await tick();
				if (!cancelled) tutorialHeading?.focus({ preventScroll: true });
				return;
			}
			activeTarget = target;
			target.scrollIntoView({
				behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
				block: window.innerWidth <= 767 ? 'start' : 'center'
			});
			await tick();
			if (cancelled) return;
			tutorialHeading?.focus({ preventScroll: true });
			updateSpotlight();
			observer = new ResizeObserver(updateSpotlight);
			observer.observe(target);
			if (tutorialPanel) observer.observe(tutorialPanel);
		};

		void locateTarget();
		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	});
</script>

<svelte:window onkeydown={handleTutorialKeydown} />

{#if tutorialOpen}
	{#if spotlightRect}
		<div
			class="tutorial-spotlight"
			style={`--spotlight-top:${spotlightRect.top}px;--spotlight-left:${spotlightRect.left}px;--spotlight-width:${spotlightRect.width}px;--spotlight-height:${spotlightRect.height}px`}
			aria-hidden="true"
		></div>
	{:else}
		<div class="tutorial-scrim" aria-hidden="true"></div>
	{/if}
	<div
		bind:this={tutorialPanel}
		class="tutorial-panel"
		class:centered={!spotlightRect}
		role="dialog"
		aria-modal="true"
		aria-labelledby="tutorial-step-title"
		aria-describedby="tutorial-step-description"
		tabindex="-1"
		style={panelPosition ? `left:${panelPosition.left}px;top:${panelPosition.top}px` : undefined}
	>
		<div class="tutorial-panel-heading">
			<div>
				<p class="tutorial-kicker">Student tutorial · Step {stepIndex + 1} of {tutorialSteps.length}</p>
				<h2 bind:this={tutorialHeading} id="tutorial-step-title" tabindex="-1">{activeStep.title}</h2>
			</div>
			<Button variant="ghost" icon="fa-solid fa-xmark" ariaLabel="Exit tutorial" title="Exit tutorial" onclick={finishTutorial} />
		</div>
		<div
			class="tutorial-progress"
			role="progressbar"
			aria-label="Tutorial progress"
			aria-valuemin={1}
			aria-valuemax={tutorialSteps.length}
			aria-valuenow={stepIndex + 1}
		>
			<span style={`width:${((stepIndex + 1) / tutorialSteps.length) * 100}%`}></span>
		</div>
		<p id="tutorial-step-description" class="tutorial-description">{activeStep.description}</p>
		{#if activeStep.tip}
			<p class="tutorial-tip"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i><span>{activeStep.tip}</span></p>
		{/if}
		{#if targetMissing}
			<p class="tutorial-fallback" role="status">
				<i class="fa-solid fa-circle-info" aria-hidden="true"></i>
				<span>{navigationError || activeStep.fallback}</span>
			</p>
		{/if}
		<div class="tutorial-controls">
			{#if isWelcome}
				<Button variant="ghost" onclick={skipWelcome}>Skip tutorial</Button>
			{:else if isCompletion}
				<span class="tutorial-complete-label"><i class="fa-solid fa-check-circle" aria-hidden="true"></i> Tutorial complete</span>
			{:else}
				<Button variant="ghost" onclick={finishTutorial}>Skip tutorial</Button>
			{/if}
			<div class="tutorial-step-controls">
				<Button variant="secondary" icon="fa-solid fa-arrow-left" onclick={previousStep} disabled={isWelcome}>Back</Button>
				<Button
					icon={isWelcome ? 'fa-solid fa-play' : isCompletion ? 'fa-solid fa-check' : 'fa-solid fa-arrow-right'}
					iconRight={!isWelcome}
					onclick={nextStep}
				>{isWelcome ? 'Start tutorial' : isCompletion ? 'Finish' : 'Next'}</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.tutorial-scrim { position: fixed; inset: 0; z-index: 70; background: rgb(12 27 20 / 58%); }
	.tutorial-spotlight {
		position: fixed;
		top: var(--spotlight-top);
		left: var(--spotlight-left);
		z-index: 70;
		width: var(--spotlight-width);
		height: var(--spotlight-height);
		border-radius: var(--radius-control);
		box-shadow: 0 0 0 3px var(--color-surface), 0 0 0 6px var(--color-primary), 0 0 0 100vmax rgb(12 27 20 / 58%);
		pointer-events: none;
	}
	.tutorial-panel {
		position: fixed;
		right: var(--space-6);
		bottom: var(--space-6);
		z-index: 80;
		width: min(23.75rem, calc(100vw - 2rem));
		max-height: min(76dvh, 38rem);
		overflow-y: auto;
		padding: var(--space-5);
		border: 1px solid var(--color-border);
		border-top: 4px solid var(--color-primary);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-raised);
	}
	.tutorial-panel.centered { top: 50%; right: auto; bottom: auto; left: 50%; transform: translate(-50%, -50%); }
	.tutorial-panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
	.tutorial-kicker { margin: 0 0 var(--space-1); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); }
	h2 { margin: 0; color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	.tutorial-description { margin: var(--space-4) 0; color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	.tutorial-progress { height: 6px; margin-top: var(--space-3); overflow: hidden; border-radius: 999px; background: var(--color-primary-soft); }
	.tutorial-progress span { display: block; height: 100%; border-radius: inherit; background: var(--color-primary); transition: width var(--motion-fast); }
	.tutorial-tip, .tutorial-fallback { display: flex; align-items: flex-start; gap: var(--space-2); margin: var(--space-3) 0; padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-bg); color: var(--color-text-muted); font-size: var(--font-size-helper); line-height: var(--line-height); }
	.tutorial-tip i, .tutorial-fallback i { flex: 0 0 auto; margin-top: 2px; color: var(--color-primary); }
	.tutorial-controls, .tutorial-step-controls { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
	.tutorial-controls { flex-wrap: wrap; margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border); }
	.tutorial-step-controls { margin-left: auto; }
	.tutorial-complete-label { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); }
	.tutorial-panel :global(:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 3px; }
	@media (max-width: 767px) {
		.tutorial-panel, .tutorial-panel.centered {
			top: auto;
			right: 0;
			bottom: 0;
			left: 0;
			width: 100%;
			max-height: min(62dvh, 32rem);
			padding: var(--space-4) max(var(--page-inline-padding), env(safe-area-inset-right, 0px)) max(var(--space-4), env(safe-area-inset-bottom, 0px)) max(var(--page-inline-padding), env(safe-area-inset-left, 0px));
			border-radius: var(--radius-panel) var(--radius-panel) 0 0;
			transform: none;
		}
		.tutorial-panel :global(.ui-button) { min-height: var(--control-height-touch); }
		:global(.student-portal [data-student-tour]) { scroll-margin-block: 7rem 64dvh; }
	}
	@media (min-width: 768px) {
		.tutorial-panel { right: auto; bottom: auto; }
	}
	@media (prefers-reduced-motion: reduce) {
		.tutorial-progress span { transition: none; }
		:global(html:has(.tutorial-panel)) { scroll-behavior: auto; }
	}
</style>
