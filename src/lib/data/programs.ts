// ESSU Graduate School program/course catalog.
// Source: client-provided requirements doc (programcourse.docx, 2026-08-18).
//
// `graduatePrograms` powers the Program/Course dropdown on the sign-up form —
// `value` is what gets stored in `users.program` (VARCHAR(100)), so it must
// stay under 100 chars and stable once students have registered against it.
//
// `programCurricula` holds the full course/unit breakdown for each program.
// Not wired to any UI yet — kept here for the planned Admin "Units of
// Education" feature (see TODO.md).

export interface CourseGroup {
	category: string;
	items: { name: string; units: number }[];
	note?: string; // e.g. "Choose 2"
}

export interface ProgramCurriculum {
	code: string;
	name: string;
	major?: string;
	groups: CourseGroup[];
	otherRequirements: string[];
	thesisConcentrations?: string[];
}

export const programCurricula: ProgramCurriculum[] = [
	{
		code: 'MSHM-HRM',
		name: 'Master of Science in Hospitality Management',
		major: 'Hotel and Restaurant Management',
		groups: [
			{
				category: 'Foundation Courses — 12 Units',
				items: [
					{ name: 'Statistics with Computer Application', units: 3 },
					{ name: 'Business Research', units: 3 },
					{ name: 'Human Behavior in Organization', units: 3 },
					{ name: 'Philosophy of Business', units: 3 }
				]
			},
			{
				category: 'Major Courses — 18 Units',
				items: [
					{ name: 'Marketing Management', units: 3 },
					{ name: 'Hospitality Management', units: 3 },
					{ name: 'Rooms Division & Front Office Management', units: 3 },
					{ name: 'Food & Beverage Management', units: 3 },
					{ name: 'Banquet, Catering, Functions & Events Management', units: 3 },
					{ name: 'Trends in the Hospitality & Tourism Management', units: 3 }
				]
			},
			{
				category: 'Cognate Courses',
				note: 'Choose 2',
				items: [
					{ name: 'Effective Communication', units: 3 },
					{ name: 'Entrepreneurship', units: 3 },
					{ name: 'Business Environment', units: 3 },
					{ name: 'Strategic Business Management', units: 3 }
				]
			}
		],
		otherRequirements: ['Seminar on Publication — 3 units', 'Comprehensive Examination', 'Thesis Writing — 6 units']
	},
	{
		code: 'MAEd-EM',
		name: 'Master of Arts in Education',
		major: 'Educational Management',
		groups: [
			{
				category: 'Core Courses — 12 Units',
				items: [
					{ name: 'Methods of Research', units: 3 },
					{ name: 'Statistical Methods', units: 3 },
					{ name: 'Bio-Psycho Foundations', units: 3 },
					{ name: 'Philo-Social Foundations', units: 3 }
				]
			},
			{
				category: 'Major Courses — 18 Units',
				items: [
					{ name: 'Human Resource Management', units: 3 },
					{ name: 'Principles & Theories of Management', units: 3 },
					{ name: 'Financial Management', units: 3 },
					{ name: 'Advanced Curriculum Development', units: 3 },
					{ name: 'Philippine Educational Legislation', units: 3 },
					{ name: 'Supervision of Instruction', units: 3 }
				]
			},
			{
				category: 'Cognate Courses — 6 Units',
				items: [
					{ name: 'Human Behavior in Organization', units: 3 },
					{ name: 'Advanced Educational Technology', units: 3 },
					{ name: 'Alternative Learning System', units: 3 },
					{ name: 'Instructional Evaluation', units: 3 },
					{ name: 'Problems in Rural & Urban Education', units: 3 },
					{ name: 'Knowledge-Based Educational Management in the Philippine Context', units: 3 }
				]
			}
		],
		otherRequirements: [
			'Seminar on Publication — 3 units',
			'Computer Software Application Training — 3 units',
			'Comprehensive Examination',
			'Thesis Writing — 6 units'
		]
	},
	{
		code: 'MAEd-KE',
		name: 'Master of Arts in Education',
		major: 'Kindergarten Education',
		groups: [
			{
				category: 'Core Courses — 12 Units',
				items: [
					{ name: 'Methods of Research', units: 3 },
					{ name: 'Advanced Statistics', units: 3 },
					{ name: 'Bio-Psycho Foundations', units: 3 },
					{ name: 'Philo-Social Foundations', units: 3 }
				]
			},
			{
				category: 'Major Courses — 18 Units',
				items: [
					{ name: 'Psychology of Early School Children Education', units: 3 },
					{ name: 'Organization, Administration, and Supervision of Early Child Education Schools', units: 3 },
					{ name: 'Strategies & Methods in Teaching Kindergarten Education', units: 3 },
					{ name: 'Conservation & Utilization of Instructional Materials in Early Child Education', units: 3 },
					{ name: 'Evaluation of Learning in Kindergarten Education', units: 3 },
					{ name: 'Language Teaching & Reading Course', units: 3 }
				]
			},
			{
				category: 'Cognate Courses — 6 Units',
				items: [
					{ name: 'Advanced Educational Technology', units: 3 },
					{ name: 'Instructional Evaluation', units: 3 },
					{ name: 'Problems in Rural & Urban Education', units: 3 },
					{ name: 'Knowledge-Based Educational Management in the Philippine Context', units: 3 }
				]
			}
		],
		otherRequirements: [
			'Seminar on Publication — 3 units',
			'Computer Software Application Training — 3 units',
			'Comprehensive Examination',
			'Thesis Writing — 6 units'
		]
	},
	{
		code: 'MAM',
		name: 'Master of Arts in Management',
		groups: [
			{
				category: 'Core Courses — 12 Units',
				items: [
					{ name: 'Methods of Research', units: 3 },
					{ name: 'Advanced Statistics', units: 3 },
					{ name: 'Social Psychology', units: 3 },
					{ name: 'Philo-Social Foundations', units: 3 }
				]
			},
			{
				category: 'Major Courses — 18 Units',
				items: [
					{ name: 'Personnel Management', units: 3 },
					{ name: 'Principles & Theories of Management', units: 3 },
					{ name: 'Financial Management', units: 3 },
					{ name: 'Project Development & Evaluation', units: 3 },
					{ name: 'Human Behavior in Organization', units: 3 },
					{ name: 'Socio-Economic Management & Development Issues & Concerns', units: 3 }
				]
			},
			{
				category: 'Cognate Courses — 6 Units',
				items: [
					{ name: 'Policy Analysis', units: 3 },
					{ name: 'Legal & Ethical Issues in Management', units: 3 },
					{ name: 'Development Support Communication', units: 3 },
					{ name: 'Total Quality Management', units: 3 },
					{ name: 'Rural & Urban Development Planning', units: 3 }
				]
			}
		],
		otherRequirements: [
			'Seminar on Publication — 3 units',
			'Computer Software Application Training — 3 units',
			'Comprehensive Examination',
			'Thesis Writing — 6 units'
		]
	},
	{
		code: 'MAIT',
		name: 'Master of Arts in Industrial Technology',
		groups: [
			{
				category: 'Basic Courses — 12 Units',
				items: [
					{ name: 'Foundation of Vocational Education', units: 3 },
					{ name: 'Technological Research Methodology', units: 3 },
					{ name: 'Industrial Statistics', units: 3 },
					{ name: 'Foundations of Modern Technology', units: 3 }
				]
			},
			{
				category: 'Major Courses',
				items: [
					{ name: 'Advanced Communication Concepts & Visual Presentations', units: 3 },
					{ name: 'Advanced Materials & Processes', units: 3 },
					{ name: 'Operation Research/Production Management', units: 3 },
					{ name: 'Industrial Immersion on Credited Industry', units: 3 },
					{ name: 'Manufacturing and Process Control', units: 3 },
					{ name: 'Human Resource Management', units: 3 },
					{ name: 'Environmental Control & Management', units: 3 },
					{ name: 'Independent Study', units: 3 },
					{ name: 'Technological Assessment, Development and Transfer', units: 3 },
					{ name: 'Advanced Instructional Methodology for Technology Education', units: 3 }
				]
			},
			{
				category: 'Electives',
				note: 'Choose according to the required 6 units',
				items: [
					{ name: 'Industrial Programming & System Design', units: 3 },
					{ name: 'Computer Aided Manufacturing System', units: 3 },
					{ name: 'Computer Networking', units: 3 },
					{ name: 'Project Management & Evaluation', units: 3 },
					{ name: 'Advanced Industrial Psychology', units: 3 }
				]
			}
		],
		otherRequirements: ['Seminar on Publication — 3 units', 'Thesis Writing/Research Project — 6 units'],
		thesisConcentrations: [
			'Construction Technology',
			'Electronics/Electrical Technology',
			'Mechanical Technology',
			'Technological Management'
		]
	}
];

/**
 * Official program names ("Units of Education") as supplied by the client.
 * These are the display + stored values for `users.program` (VARCHAR(100)) and
 * the Program filter on reports, so keep them short and stable.
 */
export const graduatePrograms: { value: string; label: string; code: string }[] = [
	{ code: 'MSHM-HRM', value: 'Master of Science in Hospitality Management (MSHM-HRM)', label: 'Master of Science in Hospitality Management (MSHM-HRM)' },
	{ code: 'MAEd-EM',  value: 'Master of Arts in Education – Educational Management',   label: 'Master of Arts in Education – Educational Management' },
	{ code: 'MAEd-KE',  value: 'Master of Arts in Education – Kindergarten Education',   label: 'Master of Arts in Education – Kindergarten Education' },
	{ code: 'MAM',      value: 'Master of Arts in Management (MAM)',                        label: 'Master of Arts in Management (MAM)' },
	{ code: 'MAIT',     value: 'Master of Arts in Industrial Technology (MAIT)',            label: 'Master of Arts in Industrial Technology (MAIT)' }
];
