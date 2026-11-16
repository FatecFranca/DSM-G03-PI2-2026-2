CREATE DATABASE IF NOT EXISTS kalix_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE kalix_db;

CREATE TABLE estabelecimento (
    id_estabelecimento INT AUTO_INCREMENT PRIMARY KEY,
    nome_fantasia VARCHAR(150) NOT NULL,
    cnpj CHAR(14) NULL UNIQUE,
    categoria VARCHAR(50) NOT NULL,
    publico_alvo VARCHAR(20) NOT NULL DEFAULT 'AMBOS',
    endereco_completo TEXT NOT NULL,
    latitude DECIMAL(9,6) NULL,
    longitude DECIMAL(9,6) NULL,
    saldo_devedor DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_estabelecimento_publico
        CHECK (publico_alvo IN ('MASCULINO', 'FEMININO', 'AMBOS'))
) ENGINE=InnoDB;

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

CREATE TABLE profissional (
    id_profissional INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cpf CHAR(11) NOT NULL UNIQUE,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    eh_dono BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_prof_estabelecimento
        FOREIGN KEY (id_estabelecimento)
        REFERENCES estabelecimento(id_estabelecimento)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE servico (
    id_servico INT AUTO_INCREMENT PRIMARY KEY,
    nome_servico VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    duracao_estimada_minutos INT NOT NULL,
    CONSTRAINT ck_servico_duracao CHECK (duracao_estimada_minutos BETWEEN 1 AND 480)
) ENGINE=InnoDB;

CREATE TABLE profissional_servico (
    id_profissional_servico INT AUTO_INCREMENT PRIMARY KEY,
    id_profissional INT NOT NULL,
    id_servico INT NOT NULL,
    preco DECIMAL(8,2) NULL,
    CONSTRAINT fk_ps_profissional
        FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional)
        ON DELETE CASCADE,
    CONSTRAINT fk_ps_servico
        FOREIGN KEY (id_servico) REFERENCES servico(id_servico)
        ON DELETE CASCADE,
    CONSTRAINT uk_profissional_servico UNIQUE (id_profissional, id_servico),
    CONSTRAINT ck_profissional_servico_preco CHECK (preco IS NULL OR preco > 0)
) ENGINE=InnoDB;

CREATE TABLE plano (
    id_plano INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL,
    id_profissional INT NULL,
    nome_plano VARCHAR(100) NOT NULL,
    preco_mensal DECIMAL(8,2) NOT NULL,
    qtd_servico_mes INT NOT NULL,
    CONSTRAINT fk_plano_estabelecimento
        FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimento(id_estabelecimento)
        ON DELETE CASCADE,
    CONSTRAINT fk_plano_profissional
        FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional)
        ON DELETE CASCADE,
    CONSTRAINT ck_plano_preco CHECK (preco_mensal > 0),
    CONSTRAINT ck_plano_servicos CHECK (qtd_servico_mes > 0)
) ENGINE=InnoDB;

CREATE TABLE oferta_plano (
    id_oferta_plano INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL,
    id_plano INT NOT NULL,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    comissao_local DECIMAL(5,2) NULL,
    CONSTRAINT fk_op_estabelecimento
        FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimento(id_estabelecimento)
        ON DELETE CASCADE,
    CONSTRAINT fk_op_plano
        FOREIGN KEY (id_plano) REFERENCES plano(id_plano)
        ON DELETE RESTRICT,
    CONSTRAINT uk_estabelecimento_plano UNIQUE (id_estabelecimento, id_plano)
) ENGINE=InnoDB;

CREATE TABLE carteira_usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    preferencia_publico VARCHAR(20) NOT NULL DEFAULT 'AMBOS',
    saldo_cashback DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    pontos_gamificacao INT NOT NULL DEFAULT 0,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_usuario_publico
        CHECK (preferencia_publico IN ('MASCULINO', 'FEMININO', 'AMBOS')),
    CONSTRAINT ck_usuario_cashback CHECK (saldo_cashback >= 0),
    CONSTRAINT ck_usuario_pontos CHECK (pontos_gamificacao >= 0)
) ENGINE=InnoDB;

CREATE TABLE assinatura_ativa (
    id_assinatura INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_plano INT NOT NULL,
    servicos_restantes INT NOT NULL,
    data_renovacao DATE NOT NULL,
    status_pagamento VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    CONSTRAINT fk_aa_usuario
        FOREIGN KEY (id_usuario) REFERENCES carteira_usuario(id_usuario)
        ON DELETE CASCADE,
    CONSTRAINT fk_aa_plano
        FOREIGN KEY (id_plano) REFERENCES plano(id_plano)
        ON DELETE RESTRICT,
    CONSTRAINT uk_usuario_plano UNIQUE (id_usuario, id_plano),
    CONSTRAINT ck_assinatura_servicos CHECK (servicos_restantes >= 0)
) ENGINE=InnoDB;

CREATE TABLE agendamento (
    id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
    id_profissional INT NOT NULL,
    id_usuario INT NULL,
    id_profissional_servico INT NULL,
    data_hora_inicio DATETIME NOT NULL,
    data_hora_fim DATETIME NOT NULL,
    status_agendamento VARCHAR(30) NOT NULL DEFAULT 'AGENDADO',
    metodo_pagamento VARCHAR(30) NOT NULL DEFAULT 'PIX',
    valor_final_cobrado DECIMAL(8,2) NULL,
    cashback_utilizado DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_agendamento_profissional
        FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional)
        ON DELETE RESTRICT,
    CONSTRAINT fk_agendamento_usuario
        FOREIGN KEY (id_usuario) REFERENCES carteira_usuario(id_usuario)
        ON DELETE SET NULL,
    CONSTRAINT fk_agendamento_ps
        FOREIGN KEY (id_profissional_servico)
        REFERENCES profissional_servico(id_profissional_servico)
        ON DELETE SET NULL,
    CONSTRAINT ck_agendamento_intervalo CHECK (data_hora_fim > data_hora_inicio),
    CONSTRAINT ck_agendamento_cashback CHECK (cashback_utilizado >= 0),
    CONSTRAINT ck_agendamento_status CHECK (
        status_agendamento IN ('AGENDADO', 'BLOQUEIO_MANUAL', 'CONCLUIDO', 'CANCELADO', 'NO_SHOW')
    ),
    CONSTRAINT ck_agendamento_pagamento CHECK (
        metodo_pagamento IN ('PIX', 'CARTAO_CREDITO', 'DINHEIRO', 'ASSINATURA', 'BLOQUEIO')
    ),
    INDEX ix_agendamento_profissional_inicio (id_profissional, data_hora_inicio),
    INDEX ix_agendamento_usuario_inicio (id_usuario, data_hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE avaliacao (
    id_avaliacao INT AUTO_INCREMENT PRIMARY KEY,
    id_agendamento INT NOT NULL UNIQUE,
    selo_servico BOOLEAN NOT NULL DEFAULT FALSE,
    selo_ambiente BOOLEAN NOT NULL DEFAULT FALSE,
    critica_privada TEXT NULL,
    cashback_liberado BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_avaliacao_agendamento
        FOREIGN KEY (id_agendamento) REFERENCES agendamento(id_agendamento)
        ON DELETE CASCADE
) ENGINE=InnoDB;
