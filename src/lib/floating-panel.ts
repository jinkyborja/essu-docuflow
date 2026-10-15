export type FloatingPanelPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

interface PositionOptions {
	placement?: FloatingPanelPlacement;
	width?: number;
	maxHeight?: number;
}

export function positionFloatingPanel(
	trigger: HTMLElement,
	panel: HTMLElement,
	{ placement = 'bottom-end', width, maxHeight }: PositionOptions = {}
) {
	const viewport = window.visualViewport;
	const edge = 8;
	const gap = 8;
	const viewportLeft = viewport?.offsetLeft ?? 0;
	const viewportTop = viewport?.offsetTop ?? 0;
	const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
	const viewportHeight = viewport?.height ?? window.innerHeight;
	const viewportRight = viewportLeft + viewportWidth;
	const viewportBottom = viewportTop + viewportHeight;
	const availableWidth = Math.max(0, viewportWidth - edge * 2);

	panel.style.setProperty('--floating-available-width', `${availableWidth}px`);
	if (width !== undefined) panel.style.width = `${Math.min(width, availableWidth)}px`;

	const triggerRect = trigger.getBoundingClientRect();
	const naturalHeight = panel.scrollHeight;
	const aboveSpace = Math.max(0, triggerRect.top - viewportTop - edge - gap);
	const belowSpace = Math.max(0, viewportBottom - triggerRect.bottom - edge - gap);
	const aboveFits = naturalHeight <= aboveSpace;
	const belowFits = naturalHeight <= belowSpace;
	const preferAbove = placement.startsWith('top-');
	const placeAbove = preferAbove
		? aboveFits || (!belowFits && aboveSpace > belowSpace)
		: !belowFits && (aboveFits || aboveSpace > belowSpace);
	const availableHeight = Math.min(placeAbove ? aboveSpace : belowSpace, maxHeight ?? Infinity);

	panel.style.maxHeight = `${availableHeight}px`;
	panel.style.setProperty('--floating-available-height', `${availableHeight}px`);

	const panelRect = panel.getBoundingClientRect();
	const alignStart = placement.endsWith('-start');
	const preferredLeft = alignStart ? triggerRect.left : triggerRect.right - panelRect.width;
	const left = Math.max(viewportLeft + edge, Math.min(preferredLeft, viewportRight - panelRect.width - edge));
	const preferredTop = placeAbove
		? triggerRect.top - panelRect.height - gap
		: triggerRect.bottom + gap;
	const top = Math.max(viewportTop + edge, Math.min(preferredTop, viewportBottom - panelRect.height - edge));

	panel.style.left = `${left}px`;
	panel.style.top = `${top}px`;
}
