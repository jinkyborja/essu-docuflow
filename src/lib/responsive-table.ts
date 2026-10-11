/** Retain table semantics and add the column labels used by the mobile card layout. */
export function responsiveTable(table: HTMLTableElement) {
	function labelCells() {
		const headings = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim() || 'Actions');
		for (const row of table.querySelectorAll('tbody tr')) {
			Array.from(row.children).forEach((cell, index) => {
				if (cell instanceof HTMLTableCellElement && cell.colSpan === 1) cell.dataset.label = headings[index] ?? '';
			});
		}
	}
	labelCells();
	const observer = new MutationObserver(labelCells);
	observer.observe(table, { childList: true, subtree: true });
	return { destroy() { observer.disconnect(); } };
}
