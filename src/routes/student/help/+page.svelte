<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	type GuideTopic = {
		title: string;
		icon: string;
		description: string;
		details: string;
	};
	type HelpItem = { category: string; question: string; answer: string };

	const helpSections: GuideTopic[] = [
		{
			title: 'Getting Started',
			icon: 'fa-solid fa-compass',
			description: 'Find your next step and access the student services in one place.',
			details: 'Your dashboard brings together active requests, recent office updates and account guidance. A verified student ID is required before you can submit a document request.'
		},
		{
			title: 'Requesting Documents',
			icon: 'fa-solid fa-file-circle-plus',
			description: 'Choose up to five available documents and check their requirements.',
			details: 'Select documents in Request Document. Requirements with the same name across your selections are shared and only need one upload. The wizard guides you from document selection to requirements, then review and submission.'
		},
		{
			title: 'Uploading Requirements',
			icon: 'fa-solid fa-cloud-arrow-up',
			description: 'Upload a file for each online requirement; shared items are listed once.',
			details: 'Requirement files accept PDF, JPG, PNG, WebP, HEIC and HEIF up to 10 MB each. Files must be nonempty and pass the existing extension and MIME-type checks. Items marked in person are handled at the Graduate School.'
		},
		{
			title: 'Reviewing and Submitting',
			icon: 'fa-solid fa-clipboard-check',
			description: 'Check the purpose, selected documents and files before you confirm.',
			details: 'The final step shows your request information for review. Confirming submits the request, and the confirmation displays its request ID. This tutorial does not submit a request.'
		},
		{
			title: 'Tracking Requests',
			icon: 'fa-solid fa-list-check',
			description: 'Follow request status, history, requirements and office messages.',
			details: 'Open My Documents to check a request timeline and its latest status. If the office requests corrections, read its message and replace the flagged requirement files there.'
		},
		{
			title: 'Notifications',
			icon: 'fa-regular fa-bell',
			description: 'Read request decisions and important updates from the office.',
			details: 'Open Notifications to review the update details. Notifications can link you back to the related request.'
		}
	];

	const helpItems: HelpItem[] = [
		{
			category: 'Requesting',
			question: 'How do I request school documents?',
			answer: 'Open Request Document, choose up to five available documents, add a file for each online requirement, then review your purpose, documents and files. Confirm the final step to submit.'
		},
		{
			category: 'Requesting',
			question: 'How many documents can I select?',
			answer: 'You can select up to five available documents in one request. Their requirements are shown before you continue.'
		},
		{
			category: 'Account',
			question: 'What if my ID verification fails?',
			answer: 'Read the rejection reason shown in the student portal. You can upload a new school ID photo from My Profile; uploading it automatically resubmits it for review. You may also add a note and request review from the verification notice.'
		},
		{
			category: 'Requirements',
			question: 'What if I upload the wrong file?',
			answer: 'Before submitting, return to Submit Requirements and choose the correct file. After submission, requirement files can be updated while the request is Pending or when the office requests corrections. Open My Documents and follow any office message.'
		},
		{
			category: 'Tracking',
			question: 'How can I track my request?',
			answer: 'Open My Documents to see request statuses, timelines, requirements and office messages. Status updates also appear in Notifications.'
		},
		{
			category: 'Corrections',
			question: 'What should I do if a request requires corrections?',
			answer: 'Open the request in My Documents, read the Graduate School office message, replace each requirement marked for correction, and submit the updated files.'
		}
	];

	let searchTerm = $state('');
	function startTutorial() {
		window.dispatchEvent(new Event('student-tutorial:start'));
	}
	const filteredHelpItems = $derived.by(() => {
		const query = searchTerm.trim().toLocaleLowerCase();
		return query
			? helpItems.filter(item => `${item.category} ${item.question} ${item.answer}`.toLocaleLowerCase().includes(query))
			: helpItems;
	});
</script>

<div class="help-center">
	<section class="tutorial-banner" aria-labelledby="tutorial-banner-title">
		<div class="banner-icon" aria-hidden="true"><i class="fa-solid fa-compass"></i></div>
		<div class="banner-copy">
			<p class="banner-eyebrow">Student walkthrough</p>
			<h2 id="tutorial-banner-title">New to DocuFlow?</h2>
			<p>Take a quick guided tour of document requests, updates and student help. It won’t submit a request or upload files.</p>
		</div>
		<div class="banner-actions">
			<Button variant="secondary" icon="fa-solid fa-play" dataTour="student-help-restart" onclick={startTutorial}>Start tutorial</Button>
			<Button variant="ghost" href="/student/request" icon="fa-solid fa-arrow-right" iconRight>Request Document</Button>
		</div>
	</section>

	<section class="guide-section" aria-labelledby="guide-title">
		<div class="section-heading">
			<div><p class="eyebrow">Student guide</p><h2 id="guide-title">How DocuFlow Works</h2></div>
			<p class="section-description">A quick overview of each part of the student portal.</p>
		</div>
		<div class="guide-grid">
			{#each helpSections as section (section.title)}
				<Card class="guide-card">
					<div class="guide-icon" aria-hidden="true"><i class={section.icon}></i></div>
					<h3>{section.title}</h3>
					<p class="guide-summary">{section.description}</p>
					<details class="guide-details">
						<summary>Learn more</summary>
						<p>{section.details}</p>
					</details>
				</Card>
			{/each}
		</div>
	</section>

	<section class="faq-section" aria-labelledby="faq-title">
		<div class="section-heading">
			<div><p class="eyebrow">Help center</p><h2 id="faq-title">Frequently Asked Questions</h2></div>
			<p class="section-description">Answers to common questions about requests and your account.</p>
		</div>
		<Card class="faq-card">
			<label class="search-label" for="help-search">Search help topics</label>
			<div class="search-wrap">
				<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
				<input id="help-search" type="search" bind:value={searchTerm} placeholder="Try “ID verification” or “wrong file”" />
			</div>
			<p class="result-count" aria-live="polite">{filteredHelpItems.length} {filteredHelpItems.length === 1 ? 'answer' : 'answers'}{searchTerm.trim() ? ' found' : ''}</p>
			{#if filteredHelpItems.length}
				<div class="faq-list">
					{#each filteredHelpItems as item (item.question)}
						<details class="faq-item">
							<summary>
								<span><span class="faq-category">{item.category}</span><span class="faq-question">{item.question}</span></span>
								<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
							</summary>
							<p class="faq-answer">{item.answer}</p>
						</details>
					{/each}
				</div>
			{:else}
				<p class="no-results">No answers match that search. Try a different word or contact the Graduate School office through its official ESSU channels.</p>
			{/if}
		</Card>
	</section>

	<section class="support-panel" aria-labelledby="support-title">
		<div class="support-icon" aria-hidden="true"><i class="fa-solid fa-headset"></i></div>
		<div class="support-copy">
			<h2 id="support-title">Need More Help?</h2>
			<p>No direct support email or phone number is listed in DocuFlow. Contact the Graduate School office through its official ESSU channels; include your request ID when asking about a request.</p>
		</div>
	</section>
</div>

<style>
	.help-center { display: flex; flex-direction: column; gap: var(--page-section-gap); min-width: 0; }
	h2, h3, p { margin: 0; }
	h2 { color: var(--color-text); font-size: var(--font-size-card-title); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	.tutorial-banner {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6);
		border: 1px solid color-mix(in srgb, var(--color-primary) 18%, transparent);
		border-radius: var(--radius-panel);
		background: linear-gradient(112deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 82%, #184a35) 100%);
		color: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.banner-icon, .support-icon { display: grid; width: 3rem; height: 3rem; flex: 0 0 auto; place-items: center; border: 1px solid color-mix(in srgb, var(--color-surface) 30%, transparent); border-radius: var(--radius-card); background: color-mix(in srgb, var(--color-surface) 12%, transparent); color: var(--color-surface); font-size: var(--font-size-card-title); }
	.banner-copy { min-width: 0; }
	.banner-eyebrow { margin-bottom: var(--space-1); color: color-mix(in srgb, var(--color-surface) 78%, transparent); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); letter-spacing: .06em; text-transform: uppercase; }
	.banner-copy h2 { color: var(--color-surface); font-size: var(--font-size-page-title); }
	.banner-copy > p:last-child { max-width: 62ch; margin-top: var(--space-1); color: color-mix(in srgb, var(--color-surface) 88%, transparent); font-size: var(--font-size-body); }
	.banner-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-2); }
	.banner-actions :global(.variant-secondary.ui-button) { border-color: var(--color-surface); color: var(--color-primary); }
	.banner-actions :global(.variant-ghost.ui-button) { color: var(--color-surface); }
	.banner-actions :global(.variant-ghost.ui-button:hover) { background: color-mix(in srgb, var(--color-surface) 14%, transparent); }
	.guide-section, .faq-section { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
	.section-heading { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: var(--space-2) var(--space-4); }
	.eyebrow { margin-bottom: var(--space-1); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); letter-spacing: .06em; text-transform: uppercase; }
	.section-description { color: var(--color-text-muted); font-size: var(--font-size-body); }
	.guide-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: var(--space-4); }
	:global(.guide-card.ui-card) { display: flex; height: 100%; flex-direction: column; align-items: flex-start; padding: var(--space-5); transition: border-color var(--motion-fast), box-shadow var(--motion-fast), transform var(--motion-fast); }
	:global(.guide-card.ui-card:hover) { border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border)); box-shadow: var(--shadow-raised); transform: translateY(-2px); }
	.guide-icon { display: grid; width: 2.5rem; height: 2.5rem; margin-bottom: var(--space-3); place-items: center; border-radius: var(--radius-control); background: var(--color-primary-soft); color: var(--color-primary); }
	h3 { color: var(--color-text); font-size: var(--font-size-input); font-weight: var(--font-weight-semibold); line-height: var(--line-height); }
	.guide-summary { margin-top: var(--space-2); color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	.guide-details { width: 100%; margin-top: auto; padding-top: var(--space-3); }
	.guide-details summary { display: inline-flex; min-height: var(--control-height-touch); align-items: center; color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-semibold); cursor: pointer; }
	.guide-details[open] summary { margin-bottom: var(--space-2); }
	.guide-details > p { color: var(--color-text-muted); font-size: var(--font-size-helper); line-height: var(--line-height); }
	.guide-details summary:focus-visible, .faq-item summary:focus-visible { border-radius: var(--radius-control); outline: 2px solid var(--color-primary); outline-offset: 3px; }
	:global(.faq-card.ui-card) { padding: var(--space-5) var(--space-6); }
	.search-label { display: block; margin-bottom: var(--space-2); color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	.search-wrap { position: relative; }
	.search-wrap > i { position: absolute; top: 50%; left: var(--space-3); color: var(--color-text-muted); transform: translateY(-50%); }
	input { width: 100%; min-height: var(--control-height-touch); padding: var(--space-2) var(--space-3) var(--space-2) var(--space-8); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; }
	input:focus-visible { border-color: var(--color-primary); outline: 2px solid var(--color-primary-soft); }
	.result-count { margin: var(--space-2) 0; color: var(--color-text-muted); font-size: var(--font-size-helper); }
	.faq-list { border-top: 1px solid var(--color-border); }
	.faq-item { border-bottom: 1px solid var(--color-border); }
	.faq-item summary { display: flex; min-height: var(--control-height-touch); align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-3) var(--space-2); cursor: pointer; list-style: none; }
	.faq-item summary::-webkit-details-marker { display: none; }
	.faq-item summary:hover { background: var(--color-primary-soft); }
	.faq-item summary > i { flex: 0 0 auto; color: var(--color-text-muted); transition: transform var(--motion-fast); }
	.faq-item[open] summary > i { transform: rotate(180deg); }
	.faq-category, .faq-question { display: block; }
	.faq-category { margin-bottom: var(--space-1); color: var(--color-primary); font-size: var(--font-size-helper); font-weight: var(--font-weight-medium); }
	.faq-question { color: var(--color-text); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); }
	.faq-answer, .no-results { padding: 0 var(--space-2) var(--space-4); color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	.support-panel { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4); padding: var(--space-5) var(--space-6); border: 1px solid var(--color-border); border-radius: var(--radius-panel); background: var(--color-surface); box-shadow: var(--shadow-card); }
	.support-icon { border-color: var(--color-border); background: var(--color-primary-soft); color: var(--color-primary); }
	.support-copy { flex: 1 1 24rem; min-width: min(100%, 16rem); }
	.support-copy p { margin-top: var(--space-1); color: var(--color-text-muted); font-size: var(--font-size-body); line-height: var(--line-height); }
	@media (max-width: 1023px) { .guide-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .tutorial-banner { grid-template-columns: auto minmax(0, 1fr); } .banner-actions { grid-column: 2; justify-content: flex-start; } }
	@media (max-width: 639px) {
		.tutorial-banner { grid-template-columns: auto minmax(0, 1fr); gap: var(--space-3); padding: var(--space-4); }
		.banner-icon { width: 2.5rem; height: 2.5rem; }
		.banner-actions { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; }
		.banner-actions :global(.button-tooltip), .banner-actions :global(.ui-button) { width: 100%; }
		.guide-grid { grid-template-columns: minmax(0, 1fr); }
		:global(.guide-card.ui-card), :global(.faq-card.ui-card) { padding: var(--space-4); }
		.support-panel { align-items: flex-start; padding: var(--space-4); }
		.support-panel > :global(.button-tooltip) { width: 100%; }
		.support-panel :global(.ui-button) { width: 100%; }
	}
	@media (prefers-reduced-motion: reduce) {
		:global(.guide-card.ui-card) { transition: none; }
		:global(.guide-card.ui-card:hover) { transform: none; }
		.faq-item summary > i { transition: none; }
	}
</style>
