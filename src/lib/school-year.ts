export const SCHOOL_YEAR_MIN = 2000;
export const SCHOOL_YEAR_MAX = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date()));
export const ENROLLED_SCHOOL_YEAR_MIN = SCHOOL_YEAR_MAX - 1;
export const SCHOOL_YEAR_DIGITS = 4;

export function validateSchoolYear(value: unknown, studentType: unknown): string | null {
	if ((typeof value !== 'string' && typeof value !== 'number') ||
		!new RegExp(`^\\d{${SCHOOL_YEAR_DIGITS}}$`).test(String(value)) || !Number.isInteger(Number(value))) {
		return 'Last school year must be a whole number with 4 digits.';
	}
	const year = Number(value);
	if (year < SCHOOL_YEAR_MIN || year > SCHOOL_YEAR_MAX) {
		return `Last school year must be between ${SCHOOL_YEAR_MIN} and ${SCHOOL_YEAR_MAX}.`;
	}
	if (studentType === 'Enrolled' && year < ENROLLED_SCHOOL_YEAR_MIN) {
		return `For enrolled students, last school year must be ${ENROLLED_SCHOOL_YEAR_MIN} or ${SCHOOL_YEAR_MAX}.`;
	}
	return null;
}
