-- Apply once to an existing Kalix database.
USE kalix_db;

ALTER TABLE estabelecimento
    MODIFY COLUMN latitude DECIMAL(9,6) NULL,
    MODIFY COLUMN longitude DECIMAL(9,6) NULL;
