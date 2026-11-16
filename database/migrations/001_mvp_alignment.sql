-- Execute once on an existing Kalix database after taking a backup.
USE kalix_db;

ALTER TABLE estabelecimento
    ADD COLUMN publico_alvo VARCHAR(20) NOT NULL DEFAULT 'AMBOS';

ALTER TABLE carteira_usuario
    ADD COLUMN preferencia_publico VARCHAR(20) NOT NULL DEFAULT 'AMBOS';

CREATE TABLE conta_estabelecimento (
    id_conta INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL UNIQUE,
    email VARCHAR(254) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    CONSTRAINT fk_conta_estabelecimento
        FOREIGN KEY (id_estabelecimento)
        REFERENCES estabelecimento(id_estabelecimento)
        ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE profissional_servico
    MODIFY COLUMN preco DECIMAL(8,2) NULL;

ALTER TABLE plano
    MODIFY COLUMN preco_mensal DECIMAL(8,2) NOT NULL;

ALTER TABLE agendamento
    MODIFY COLUMN status_agendamento VARCHAR(30) NOT NULL DEFAULT 'AGENDADO',
    MODIFY COLUMN metodo_pagamento VARCHAR(30) NOT NULL DEFAULT 'PIX',
    MODIFY COLUMN valor_final_cobrado DECIMAL(8,2) NULL,
    ADD COLUMN cashback_utilizado DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    ADD INDEX ix_agendamento_profissional_inicio (id_profissional, data_hora_inicio),
    ADD INDEX ix_agendamento_usuario_inicio (id_usuario, data_hora_inicio);
