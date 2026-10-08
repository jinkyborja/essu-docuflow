-- Preserve the legacy column for compatibility while new code uses request_items.
ALTER TABLE requests MODIFY COLUMN document_id INT NULL;

CREATE TABLE request_items (
    item_id      INT PRIMARY KEY AUTO_INCREMENT,
    request_id   VARCHAR(20) NOT NULL,
    document_id  INT NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_request_items_request_document (request_id, document_id),
    CONSTRAINT fk_request_items_request FOREIGN KEY (request_id)
        REFERENCES requests(request_id) ON DELETE CASCADE,
    CONSTRAINT fk_request_items_document FOREIGN KEY (document_id)
        REFERENCES documents(document_id)
);

INSERT INTO request_items (request_id, document_id)
SELECT request_id, document_id
FROM requests
WHERE document_id IS NOT NULL;
