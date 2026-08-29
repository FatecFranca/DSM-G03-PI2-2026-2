CREATE DATABASE IF NOT EXISTS kalix_db
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE kalix_db;

CREATE TABLE estabelecimento (
    id_estabelecimento INT AUTO_INCREMENT PRIMARY KEY,
    nome_fantasia VARCHAR(150) NOT NULL,
    cnpj VARCHAR(14) NULL UNIQUE,
    categoria VARCHAR(50) NOT NULL,
    endereco_completo TEXT NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    saldo_devedor DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profissional (
    id_profissional INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL,
    nome VARCHAR(150) NOT NULL,
    cpf CHAR(11) NOT NULL UNIQUE,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    eh_dono BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_prof_estabelecimento 
        FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimento(id_estabelecimento) 
        ON DELETE RESTRICT
);

CREATE TABLE servico (
    id_servico INT AUTO_INCREMENT PRIMARY KEY,
    nome_servico VARCHAR(100) NOT NULL,
    descricao TEXT NULL,
    duracao_estimada_minutos INT NOT NULL
);

CREATE TABLE profissional_servico (
    id_profissional_servico INT AUTO_INCREMENT PRIMARY KEY,
    id_profissional INT NOT NULL,
    id_servico INT NOT NULL,
    preco DECIMAL(6,2) NULL,
    CONSTRAINT fk_ps_profissional 
        FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional) ON DELETE CASCADE,
    CONSTRAINT fk_ps_servico 
        FOREIGN KEY (id_servico) REFERENCES servico(id_servico) ON DELETE CASCADE,
    CONSTRAINT uk_profissional_servico UNIQUE (id_profissional, id_servico)
);

CREATE TABLE plano (
    id_plano INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL,
    id_profissional INT NULL,
    nome_plano VARCHAR(100) NOT NULL,
    preco_mensal DECIMAL(6,2) NOT NULL,
    qtd_servico_mes INT NOT NULL,
    CONSTRAINT fk_plano_estabelecimento 
        FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimento(id_estabelecimento) ON DELETE CASCADE,
    CONSTRAINT fk_plano_profissional 
        FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional) ON DELETE CASCADE
);

CREATE TABLE oferta_plano (
    id_oferta_plano INT AUTO_INCREMENT PRIMARY KEY,
    id_estabelecimento INT NOT NULL,
    id_plano INT NOT NULL,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    comissao_local DECIMAL(5,2) NULL,
    CONSTRAINT fk_op_estabelecimento 
        FOREIGN KEY (id_estabelecimento) REFERENCES estabelecimento(id_estabelecimento) ON DELETE CASCADE,
    CONSTRAINT fk_op_plano 
        FOREIGN KEY (id_plano) REFERENCES plano(id_plano) ON DELETE RESTRICT,
    CONSTRAINT uk_estabelecimento_plano UNIQUE (id_estabelecimento, id_plano)
);

CREATE TABLE carteira_usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome_completo VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    saldo_cashback DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    pontos_gamificacao INT NOT NULL DEFAULT 0,
    status_ativo BOOLEAN NOT NULL DEFAULT TRUE,
    data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE assinatura_ativa (
    id_assinatura INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_plano INT NOT NULL,
    servicos_restantes INT NOT NULL,
    data_renovacao DATE NOT NULL,
    status_pagamento ENUM('ATIVO', 'ATRASADO', 'CANCELADO', 'AGUARDANDO_PAGAMENTO') NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    CONSTRAINT fk_aa_usuario 
        FOREIGN KEY (id_usuario) REFERENCES carteira_usuario(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_aa_plano 
        FOREIGN KEY (id_plano) REFERENCES plano(id_plano) ON DELETE RESTRICT,
    CONSTRAINT uk_usuario_plano UNIQUE (id_usuario, id_plano)
);

CREATE TABLE agendamento (
    id_agendamento INT AUTO_INCREMENT PRIMARY KEY,
    id_profissional INT NOT NULL,
    id_usuario INT NULL,
    id_profissional_servico INT NULL,
    data_hora_inicio DATETIME NOT NULL,
    data_hora_fim DATETIME NOT NULL,
    status_agendamento ENUM('AGENDADO', 'CONCLUIDO', 'CANCELADO', 'NO_SHOW') NOT NULL DEFAULT 'AGENDADO',
    metodo_pagamento ENUM('PIX', 'CARTAO_CREDITO', 'DINHEIRO', 'ASSINATURA') NOT NULL,
    valor_final_cobrado DECIMAL(6,2) NULL,
    CONSTRAINT fk_agendamento_profissional 
        FOREIGN KEY (id_profissional) REFERENCES profissional(id_profissional) ON DELETE RESTRICT,
    CONSTRAINT fk_agendamento_usuario 
        FOREIGN KEY (id_usuario) REFERENCES carteira_usuario(id_usuario) ON DELETE SET NULL,
    CONSTRAINT fk_agendamento_ps 
        FOREIGN KEY (id_profissional_servico) REFERENCES profissional_servico(id_profissional_servico) ON DELETE SET NULL
);

CREATE TABLE avaliacao (
    id_avaliacao INT AUTO_INCREMENT PRIMARY KEY,
    id_agendamento INT NOT NULL UNIQUE,
    selo_servico BOOLEAN NOT NULL DEFAULT FALSE,
    selo_ambiente BOOLEAN NOT NULL DEFAULT FALSE,
    critica_privada TEXT NULL,
    cashback_liberado BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_avaliacao_agendamento 
        FOREIGN KEY (id_agendamento) REFERENCES agendamento(id_agendamento) ON DELETE CASCADE
);