export interface FormFile {
	file_id?: number;
	page_no: number;
	storage_path: string | null;
	public_url: string;
}

export interface FormRecord {
	form_id: number;
	title: string;
	category: string;
	code: string | null;
	description: string;
	fields: string[];
	download_name: string;
	created_at?: string;
	updated_at?: string;
	files: FormFile[];
}

export const formCategories = ['Registration', 'Clearance', 'Evaluation', 'Academic Records'];
