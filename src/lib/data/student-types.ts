// Mirrors the `users.student_type` ENUM in database/db.sql.
// Descriptions are shown under each option in the sign-up dropdown.
export const studentTypes: { value: string; label: string; description: string }[] = [
	{
		value: 'Enrolled',
		label: 'Currently Enrolled',
		description: 'You are actively taking classes and are currently enrolled this semester.'
	},
	{
		value: 'Supplemental',
		label: 'Supplemental',
		description: 'You are completing or retaking specific units or subjects to fulfill graduation requirements.'
	},
	{
		value: 'Former',
		label: 'Former Student',
		description: 'You have previously attended ESSU but are no longer actively enrolled.'
	},
	{
		value: 'Alumni',
		label: 'Alumni',
		description: 'You have already graduated from ESSU and are requesting documents as a graduate.'
	}
];

// Suffix options for the name fields.
export const nameSuffixes: { value: string; label: string }[] = [
	{ value: 'Jr.', label: 'Jr.' },
	{ value: 'Sr.', label: 'Sr.' },
	{ value: 'II', label: 'II' },
	{ value: 'III', label: 'III' },
	{ value: 'IV', label: 'IV' }
];
