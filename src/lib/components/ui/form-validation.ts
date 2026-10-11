/** UI validation only. API validation remains authoritative. */
export function validateForm(form: HTMLFormElement) {
	form.noValidate = true;
	function validate(event: SubmitEvent) {
		const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'));
		let first: typeof controls[number] | undefined;
		for (const control of controls) {
			control.dispatchEvent(new Event('ui-validate'));
			if (!control.checkValidity() && !first) first = control;
		}
		if (first) { event.preventDefault(); event.stopImmediatePropagation(); first.focus(); }
	}
	form.addEventListener('submit', validate, true);
	return { destroy() { form.removeEventListener('submit', validate, true); } };
}
