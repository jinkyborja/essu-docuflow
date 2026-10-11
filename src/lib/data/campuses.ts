// ESSU campus directory: https://main.essu.edu.ph/index.php/essudyantes
// Store the campus name so it can be compared with imported enrollment records.
export const campuses = [
	{ value: 'Borongan', label: 'Borongan (Main Campus)' },
	{ value: 'Arteche', label: 'Arteche' },
	{ value: 'Balangiga', label: 'Balangiga' },
	{ value: 'Can-Avid', label: 'Can-Avid' },
	{ value: 'Guiuan', label: 'Guiuan' },
	{ value: 'Maydolong', label: 'Maydolong' },
	{ value: 'Salcedo', label: 'Salcedo' }
];

export function isCampus(value: unknown): value is string {
	return typeof value === 'string' && campuses.some(campus => campus.value === value);
}
