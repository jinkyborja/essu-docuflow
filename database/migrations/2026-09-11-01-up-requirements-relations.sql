-- =============================================================================
-- Stage 1 — replace the two JSON blob columns with proper relations (1NF).
--
-- Deliberately does NOT drop documents.requirements / requests.requirements.
-- They stay as the source of truth until the application code is migrated and
-- verified; 03-finalize drops them. That keeps rollback trivial.
-- =============================================================================

-- Master list of requirement types, defined once.
CREATE TABLE IF NOT EXISTS requirements (
    requirement_id INT PRIMARY KEY AUTO_INCREMENT,
    name           VARCHAR(100) NOT NULL UNIQUE,
    description    VARCHAR(255) NULL
);

-- Every distinct requirement name appearing in either blob.
INSERT INTO requirements (name, description)
SELECT src.name, SUBSTRING(MAX(src.description), 1, 255)
FROM (
    SELECT jt.name, jt.description
    FROM documents d,
         JSON_TABLE(COALESCE(d.requirements, '[]'), '$[*]'
             COLUMNS (name VARCHAR(100) PATH '$.name',
                      description VARCHAR(255) PATH '$.description')) AS jt
    WHERE jt.name IS NOT NULL
    UNION ALL
    SELECT jt.name, jt.description
    FROM requests r,
         JSON_TABLE(COALESCE(r.requirements, '[]'), '$[*]'
             COLUMNS (name VARCHAR(100) PATH '$.name',
                      description VARCHAR(255) PATH '$.description')) AS jt
    WHERE jt.name IS NOT NULL
) AS src
GROUP BY src.name
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Which requirements each document asks for.
CREATE TABLE IF NOT EXISTS document_requirements (
    document_id    INT NOT NULL,
    requirement_id INT NOT NULL,
    in_person      BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order     INT NOT NULL DEFAULT 0,
    PRIMARY KEY (document_id, requirement_id),
    FOREIGN KEY (document_id)    REFERENCES documents(document_id)      ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES requirements(requirement_id)
);

INSERT IGNORE INTO document_requirements (document_id, requirement_id, in_person, sort_order)
SELECT d.document_id, rq.requirement_id, COALESCE(jt.in_person, 0), jt.ord - 1
FROM documents d
JOIN JSON_TABLE(COALESCE(d.requirements, '[]'), '$[*]'
        COLUMNS (ord FOR ORDINALITY,
                 name VARCHAR(100) PATH '$.name',
                 in_person BOOLEAN PATH '$.in_person')) AS jt
JOIN requirements rq ON rq.name = jt.name;

-- What the student actually submitted per requirement.
CREATE TABLE IF NOT EXISTS request_requirements (
    request_id       VARCHAR(20) NOT NULL,
    requirement_id   INT NOT NULL,
    in_person        BOOLEAN NOT NULL DEFAULT FALSE,
    file_path        VARCHAR(255) NULL,
    file_name        VARCHAR(255) NULL,
    submitted_at     DATETIME NULL,
    needs_correction BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order       INT NOT NULL DEFAULT 0,
    PRIMARY KEY (request_id, requirement_id),
    FOREIGN KEY (request_id)     REFERENCES requests(request_id)        ON DELETE CASCADE,
    FOREIGN KEY (requirement_id) REFERENCES requirements(requirement_id)
);

INSERT IGNORE INTO request_requirements
    (request_id, requirement_id, in_person, file_path, file_name, submitted_at, needs_correction, sort_order)
SELECT r.request_id, rq.requirement_id,
       COALESCE(jt.in_person, 0), jt.file_path, jt.file_name,
       -- stored as ISO-8601 with a trailing Z; STR_TO_DATE keeps it as DATETIME
       CASE WHEN jt.submitted_at IS NULL OR jt.submitted_at = '' THEN NULL
            ELSE STR_TO_DATE(REPLACE(REPLACE(jt.submitted_at,'T',' '),'Z',''), '%Y-%m-%d %H:%i:%s.%f') END,
       COALESCE(jt.needs_correction, 0), jt.ord - 1
FROM requests r
JOIN JSON_TABLE(COALESCE(r.requirements, '[]'), '$[*]'
        COLUMNS (ord FOR ORDINALITY,
                 name VARCHAR(100) PATH '$.name',
                 in_person BOOLEAN PATH '$.in_person',
                 file_path VARCHAR(255) PATH '$.file_path',
                 file_name VARCHAR(255) PATH '$.file_name',
                 submitted_at VARCHAR(40) PATH '$.submitted_at',
                 needs_correction BOOLEAN PATH '$.needs_correction')) AS jt
JOIN requirements rq ON rq.name = jt.name;
