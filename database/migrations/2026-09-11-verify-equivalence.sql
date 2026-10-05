-- Field-by-field comparison: every element of the original JSON blob must have a
-- matching row in the new tables, and vice versa. Any output row = a discrepancy.

SELECT '--- requests: JSON element with no matching row (or mismatched field) ---' AS check_name;
SELECT r.request_id, jt.name, 'MISSING_OR_MISMATCH' AS problem,
       jt.file_path AS json_file_path, rr.file_path AS row_file_path,
       jt.needs_correction AS json_flag, rr.needs_correction AS row_flag,
       jt.in_person AS json_in_person, rr.in_person AS row_in_person
FROM requests r
JOIN JSON_TABLE(COALESCE(r.requirements,'[]'), '$[*]'
      COLUMNS (name VARCHAR(100) PATH '$.name',
               in_person BOOLEAN PATH '$.in_person',
               file_path VARCHAR(255) PATH '$.file_path',
               file_name VARCHAR(255) PATH '$.file_name',
               submitted_at VARCHAR(40) PATH '$.submitted_at',
               needs_correction BOOLEAN PATH '$.needs_correction')) jt
JOIN requirements rq ON rq.name = jt.name
LEFT JOIN request_requirements rr
       ON rr.request_id = r.request_id AND rr.requirement_id = rq.requirement_id
WHERE rr.request_id IS NULL
   OR NOT (rr.file_path <=> jt.file_path)
   OR NOT (rr.file_name <=> jt.file_name)
   OR rr.needs_correction <> COALESCE(jt.needs_correction,0)
   OR rr.in_person <> COALESCE(jt.in_person,0)
   OR NOT (DATE_FORMAT(rr.submitted_at,'%Y-%m-%dT%H:%i:%s.000Z') <=> NULLIF(jt.submitted_at,''));

SELECT '--- requests: row with no corresponding JSON element (extra data) ---' AS check_name;
SELECT rr.request_id, rq.name, 'EXTRA_ROW' AS problem
FROM request_requirements rr
JOIN requirements rq ON rq.requirement_id = rr.requirement_id
LEFT JOIN (
    SELECT r.request_id, jt.name
    FROM requests r
    JOIN JSON_TABLE(COALESCE(r.requirements,'[]'), '$[*]'
          COLUMNS (name VARCHAR(100) PATH '$.name')) jt
) src ON src.request_id = rr.request_id AND src.name = rq.name
WHERE src.request_id IS NULL;

SELECT '--- documents: JSON element vs document_requirements ---' AS check_name;
SELECT d.document_id, jt.name, 'MISSING_OR_MISMATCH' AS problem,
       jt.in_person AS json_in_person, dr.in_person AS row_in_person
FROM documents d
JOIN JSON_TABLE(COALESCE(d.requirements,'[]'), '$[*]'
      COLUMNS (name VARCHAR(100) PATH '$.name',
               in_person BOOLEAN PATH '$.in_person')) jt
JOIN requirements rq ON rq.name = jt.name
LEFT JOIN document_requirements dr
       ON dr.document_id = d.document_id AND dr.requirement_id = rq.requirement_id
WHERE dr.document_id IS NULL
   OR dr.in_person <> COALESCE(jt.in_person,0);

SELECT '--- counts: JSON elements vs migrated rows ---' AS check_name;
SELECT
  (SELECT COUNT(*) FROM requests r
     JOIN JSON_TABLE(COALESCE(r.requirements,'[]'),'$[*]' COLUMNS(n VARCHAR(100) PATH '$.name')) j) AS json_request_items,
  (SELECT COUNT(*) FROM request_requirements) AS migrated_request_rows,
  (SELECT COUNT(*) FROM documents d
     JOIN JSON_TABLE(COALESCE(d.requirements,'[]'),'$[*]' COLUMNS(n VARCHAR(100) PATH '$.name')) j) AS json_document_items,
  (SELECT COUNT(*) FROM document_requirements) AS migrated_document_rows;
