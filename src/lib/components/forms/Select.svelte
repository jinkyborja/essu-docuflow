<script lang="ts">
	// Custom single-select dropdown. Replaces native <select> where we want
	// consistent styling, room for per-option descriptions, and long labels that
	// wrap instead of blowing out the container.
	//
	// Native form validation does not apply to this (there is no <select>), so any
	// "required" enforcement must live in the submitting form's own guard.

	export type SelectOption = {
		value: string;
		label: string;
		description?: string;
	};

	interface Props {
		options: SelectOption[];
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		/** Rendered as the accessible name of the trigger button. */
		ariaLabel?: string;
	}

	let {
		options,
		value = $bindable(''),
		placeholder = 'Select...',
		disabled = false,
		ariaLabel
	}: Props = $props();

	let open = $state(false);
	let activeIndex = $state(-1);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);

	const selected = $derived(options.find((o) => o.value === value) ?? null);
	const listId = `select-list-${Math.random().toString(36).slice(2, 9)}`;

	function openList() {
		if (disabled) return;
		open = true;
		// Start navigation from the current selection so arrow keys feel natural.
		activeIndex = selected ? options.findIndex((o) => o.value === selected.value) : 0;
	}

	function closeList() {
		open = false;
		activeIndex = -1;
	}

	function choose(index: number) {
		const opt = options[index];
		if (!opt) return;
		value = opt.value;
		closeList();
		triggerEl?.focus();
	}

	function onTriggerKeydown(e: KeyboardEvent) {
		if (disabled) return;
		if (!open) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				openList();
			}
			return;
		}
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				activeIndex = (activeIndex + 1) % options.length;
				break;
			case 'ArrowUp':
				e.preventDefault();
				activeIndex = (activeIndex - 1 + options.length) % options.length;
				break;
			case 'Home':
				e.preventDefault();
				activeIndex = 0;
				break;
			case 'End':
				e.preventDefault();
				activeIndex = options.length - 1;
				break;
			case 'Enter':
			case ' ':
				e.preventDefault();
				choose(activeIndex);
				break;
			case 'Escape':
			case 'Tab':
				closeList();
				break;
		}
	}

	// Close when focus or a click lands outside the component.
	function onWindowPointerDown(e: PointerEvent) {
		if (!open) return;
		const target = e.target as Node;
		if (triggerEl?.contains(target) || listEl?.contains(target)) return;
		closeList();
	}

	// Keep the highlighted option in view while arrowing through a long list.
	$effect(() => {
		if (!open || activeIndex < 0 || !listEl) return;
		listEl.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
	});
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="relative">
	<button
		bind:this={triggerEl}
		type="button"
		{disabled}
		role="combobox"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={open ? listId : undefined}
		aria-activedescendant={open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
		aria-label={ariaLabel}
		onclick={() => (open ? closeList() : openList())}
		onkeydown={onTriggerKeydown}
		class="w-full flex items-start gap-2 text-left px-3 py-2.5 border rounded-lg text-sm bg-white transition-colors
			focus:outline-none focus:ring-2 focus:ring-essu-green/30 focus:border-essu-green-light
			disabled:opacity-60 disabled:cursor-not-allowed
			{open ? 'border-essu-green-light ring-2 ring-essu-green/30' : 'border-gray-200 hover:border-gray-300'}"
	>
		<span class="flex-1 min-w-0 break-words {selected ? 'text-gray-800' : 'text-gray-400'}">
			{selected ? selected.label : placeholder}
		</span>
		<i
			class="fa-solid fa-chevron-down text-xs text-gray-400 shrink-0 mt-1 transition-transform duration-150
				{open ? 'rotate-180' : ''}"
		></i>
	</button>

	{#if open}
		<div
			bind:this={listEl}
			id={listId}
			role="listbox"
			tabindex="-1"
			class="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1"
		>
			{#each options as opt, i (opt.value)}
				{@const isSelected = opt.value === value}
				<button
					type="button"
					role="option"
					id="{listId}-opt-{i}"
					aria-selected={isSelected}
					tabindex="-1"
					data-index={i}
					onclick={() => choose(i)}
					onmouseenter={() => (activeIndex = i)}
					class="w-full text-left px-3 py-2 cursor-pointer flex items-start gap-2 transition-colors
						{i === activeIndex ? 'bg-essu-green/10' : ''}"
				>
					<div class="flex-1 min-w-0">
						<p class="text-sm break-words {isSelected ? 'text-essu-green font-medium' : 'text-gray-700'}">
							{opt.label}
						</p>
						{#if opt.description}
							<p class="text-xs text-gray-400 mt-0.5 leading-relaxed">{opt.description}</p>
						{/if}
					</div>
					{#if isSelected}
						<i class="fa-solid fa-check text-essu-green text-xs shrink-0 mt-1"></i>
					{/if}
				</button>
			{/each}

			{#if options.length === 0}
				<p class="px-3 py-2 text-sm text-gray-400">No options available</p>
			{/if}
		</div>
	{/if}
</div>
