<script lang="ts">
	import { tick } from 'svelte';
	import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from 'pdfjs-dist';
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

	GlobalWorkerOptions.workerSrc = workerUrl;

	let { file }: { file: Blob } = $props();
	let viewer = $state<HTMLDivElement>();
	let loading = $state(true);
	let error = $state('');
	let pages = $state<number[]>([]);
	let retry = $state(0);
	let generation = 0;
	let loadingTask: PDFDocumentLoadingTask | null = null;
	let pdf: PDFDocumentProxy | null = null;
	let pageObserver: IntersectionObserver | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let observedWidth = 0;
	const visiblePages = new Set<number>();
	const renderTasks = new Map<number, RenderTask>();
	const renderedWidths = new Map<number, number>();

	function releasePage(pageNumber: number, slot: HTMLElement) {
		const task = renderTasks.get(pageNumber);
		if (task) {
			task.cancel();
			renderTasks.delete(pageNumber);
		}
		const canvas = slot.querySelector('canvas');
		if (canvas) {
			canvas.width = 0;
			canvas.height = 0;
			canvas.remove();
		}
		renderedWidths.delete(pageNumber);
	}

	function clearViewer() {
		pageObserver?.disconnect();
		pageObserver = null;
		resizeObserver?.disconnect();
		resizeObserver = null;
		observedWidth = 0;
		for (const task of renderTasks.values()) task.cancel();
		renderTasks.clear();
		renderedWidths.clear();
		visiblePages.clear();
		const task = loadingTask;
		loadingTask = null;
		pdf = null;
		if (task) void task.destroy();
		viewer?.querySelectorAll('canvas').forEach((canvas) => {
			canvas.width = 0;
			canvas.height = 0;
		});
	}

	async function renderPage(pageNumber: number, current: number) {
		const documentProxy = pdf;
		const root = viewer;
		const slot = root?.querySelector<HTMLElement>(`[data-pdf-page="${pageNumber}"]`);
		if (!documentProxy || !root || !slot || current !== generation || renderTasks.has(pageNumber)) return;
		const availableWidth = Math.floor(root.clientWidth - 20);
		if (availableWidth < 80) return;
		if (renderedWidths.get(pageNumber) === availableWidth && slot.querySelector('canvas')) return;

		let page: PDFPageProxy | null = null;
		let activeRenderTask: RenderTask | null = null;
		try {
			page = await documentProxy.getPage(pageNumber);
			if (current !== generation || !slot.isConnected) return;
			const baseViewport = page.getViewport({ scale: 1 });
			const scale = availableWidth / baseViewport.width;
			const viewport = page.getViewport({ scale });
			const pixelBudget = window.matchMedia('(max-width: 640px)').matches ? 4_000_000 : 16_000_000;
			const outputScale = Math.min(
				window.devicePixelRatio || 1,
				2,
				Math.sqrt(pixelBudget / (viewport.width * viewport.height))
			);
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
			canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
			canvas.style.width = `${viewport.width}px`;
			canvas.style.height = `${viewport.height}px`;
			canvas.setAttribute('aria-label', `PDF page ${pageNumber}`);
			slot.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
			slot.replaceChildren(canvas);
			const context = canvas.getContext('2d', { alpha: false });
			if (!context) throw new Error('Canvas is unavailable');
			const renderTask = page.render({
				canvasContext: context,
				viewport: page.getViewport({ scale: scale * outputScale })
			});
			activeRenderTask = renderTask;
			renderTasks.set(pageNumber, renderTask);
			await renderTask.promise;
			if (current === generation && slot.isConnected) renderedWidths.set(pageNumber, availableWidth);
		} catch (problem) {
			if (current === generation && (problem as Error).name !== 'RenderingCancelledException') {
				error = 'Unable to load PDF preview. Please try again.';
			}
		} finally {
			page?.cleanup();
			if (renderTasks.get(pageNumber) === activeRenderTask) renderTasks.delete(pageNumber);
		}
	}

	function observePages(current: number) {
		if (!viewer) return;
		pageObserver?.disconnect();
		if ('IntersectionObserver' in window) {
			pageObserver = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					const slot = entry.target as HTMLElement;
					const pageNumber = Number(slot.dataset.pdfPage);
					if (entry.isIntersecting) {
						visiblePages.add(pageNumber);
						void renderPage(pageNumber, current);
					} else {
						visiblePages.delete(pageNumber);
						releasePage(pageNumber, slot);
					}
				}
			}, { root: viewer, rootMargin: '1000px 0px' });
			viewer.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach((slot) => pageObserver?.observe(slot));
			if (pages.length) {
				visiblePages.add(1);
				void renderPage(1, current);
			}
		} else {
			for (const pageNumber of pages) void renderPage(pageNumber, current);
		}
		resizeObserver?.disconnect();
		resizeObserver = new ResizeObserver((entries) => {
			if (!entries.length || current !== generation) return;
			const width = Math.floor((viewer?.clientWidth ?? entries[0].contentRect.width) - 20);
			if (Math.abs(width - observedWidth) > 2) {
				observedWidth = width;
				for (const pageNumber of visiblePages) {
					const slot = viewer?.querySelector<HTMLElement>(`[data-pdf-page="${pageNumber}"]`);
					if (!slot) continue;
					if (width < 80) releasePage(pageNumber, slot);
					else if (renderedWidths.get(pageNumber) !== width) {
						releasePage(pageNumber, slot);
						void renderPage(pageNumber, current);
					}
				}
			} else observedWidth = width;
		});
		resizeObserver.observe(viewer);
	}

	$effect(() => {
		const source = file;
		void retry;
		if (!source) return;
		const current = ++generation;
		loading = true;
		error = '';
		pages = [];
		clearViewer();
		let active = true;

		void (async () => {
			try {
				const task = getDocument({ data: new Uint8Array(await source.arrayBuffer()), isEvalSupported: false });
				loadingTask = task;
				const documentProxy = await task.promise;
				if (!active || current !== generation) return;
				if (!documentProxy.numPages) throw new Error('No PDF pages');
				pdf = documentProxy;
				pages = Array.from({ length: documentProxy.numPages }, (_, index) => index + 1);
				await tick();
				if (active && current === generation) observePages(current);
			} catch {
				if (active && current === generation) error = 'Unable to load PDF preview. Please try again.';
			} finally {
				if (active && current === generation) loading = false;
			}
		})();

		return () => {
			active = false;
			if (current === generation) generation++;
			clearViewer();
		};
	});
</script>

<div class="pdf-viewer" bind:this={viewer} role="region" aria-label="PDF preview pages" aria-busy={loading}>
	{#if loading}
		<p class="pdf-viewer-state" role="status">Loading PDF preview...</p>
	{:else if error}
		<div class="pdf-viewer-error" role="alert">
			<p>{error}</p>
			<button type="button" onclick={() => retry++}>Retry</button>
		</div>
	{:else}
		{#each pages as pageNumber (pageNumber)}
			<div class="pdf-page" data-pdf-page={pageNumber} role="group" aria-label={`PDF page ${pageNumber}`}></div>
		{/each}
	{/if}
</div>

<style>
	.pdf-viewer { display: flex; min-width: 0; min-height: 0; flex-direction: column; align-items: center; gap: var(--space-3); overflow: auto; overscroll-behavior: contain; padding: var(--space-2); background: var(--color-bg); scrollbar-gutter: stable; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
	.pdf-page { position: relative; flex: 0 0 auto; width: 100%; max-width: 100%; aspect-ratio: 0.773 / 1; overflow: hidden; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); box-shadow: var(--shadow-card); }
	.pdf-page canvas { display: block; max-width: 100%; height: auto !important; margin-inline: auto; }
	.pdf-viewer-state, .pdf-viewer-error { margin: auto; color: var(--color-text-muted); text-align: center; }
	.pdf-viewer-error { display: grid; justify-items: center; gap: var(--space-3); }
	.pdf-viewer-error p { margin: 0; }
	.pdf-viewer-error button { min-height: var(--control-height-touch); border: 1px solid var(--color-primary); border-radius: var(--radius-control); background: var(--color-surface); padding-inline: var(--space-4); color: var(--color-primary); font-weight: var(--font-weight-medium); }
	.pdf-viewer-error button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
</style>
