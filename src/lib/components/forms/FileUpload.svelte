<script lang="ts">
	interface Props {
		label: string;
		accept?: string;
		required?: boolean;
		file?: File | null;
		onFileSelect?: (file: File | null) => void;
	}

	const { label, accept = '*', required = false, file = null, onFileSelect }: Props = $props();

	let inputEl: HTMLInputElement;
	let isDragging = $state(false);

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		onFileSelect?.(input.files?.[0] ?? null);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const dropped = e.dataTransfer?.files[0];
		if (dropped) onFileSelect?.(dropped);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function clearFile() {
		onFileSelect?.(null);
		if (inputEl) inputEl.value = '';
	}
</script>

<div class="space-y-1.5">
	<label class="text-sm font-medium text-gray-700">
		{label}
		{#if required}<span class="text-red-500 ml-0.5">*</span>{/if}
	</label>

	{#if file}
		<!-- File selected state -->
		<div class="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
			<i class="fa-solid fa-file-check text-green-600"></i>
			<span class="text-sm text-green-700 flex-1 truncate">{file.name}</span>
			<button
				onclick={clearFile}
				class="text-green-500 hover:text-red-500 transition-colors text-xs"
				aria-label="Remove file"
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	{:else}
		<!-- Drop zone -->
		<div
			role="button"
			tabindex="0"
			class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
				{isDragging ? 'border-essu-green bg-green-50' : 'border-gray-200 hover:border-essu-green-light hover:bg-gray-50'}"
			onclick={() => inputEl.click()}
			onkeydown={(e) => e.key === 'Enter' && inputEl.click()}
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={() => (isDragging = false)}
		>
			<i class="fa-solid fa-cloud-arrow-up text-2xl {isDragging ? 'text-essu-green' : 'text-gray-300'} mb-2"></i>
			<p class="text-sm text-gray-500">
				<span class="text-essu-green font-medium">Click to upload</span> or drag & drop
			</p>
			<p class="text-xs text-gray-400 mt-0.5">Accepted: {accept}</p>
		</div>
		<input
			bind:this={inputEl}
			type="file"
			{accept}
			class="hidden"
			onchange={handleFileChange}
		/>
	{/if}
</div>
