-- forms.form_id is signed INT in db.sql; no character collation applies.
ALTER TABLE requirements
    ADD COLUMN form_id INT NULL,
    ADD COLUMN needs_signature BOOLEAN NULL DEFAULT 0,
    ADD COLUMN signature_note VARCHAR(200) NULL,
    ADD CONSTRAINT fk_requirements_form
        FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE SET NULL;
