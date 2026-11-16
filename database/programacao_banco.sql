-- =====================================================================
-- Kalix — Programação no banco de dados (Views, Trigger e Procedure)
-- Disciplina: Banco de Dados Relacional — 2º semestre DSM, Fatec Franca
--
-- Executar DEPOIS de database/schema.sql:
--   mysql -u usuario -p < database/programacao_banco.sql
-- O script pode ser executado mais de uma vez (usa DROP ... IF EXISTS).
-- =====================================================================
USE kalix_db;

-- ---------------------------------------------------------------------
-- VIEW 1: agenda detalhada
-- Junta agendamento + cliente + profissional + serviço + estabelecimento
-- para consultar a agenda sem repetir os JOINs na aplicação.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS vw_agenda_detalhada;
CREATE VIEW vw_agenda_detalhada AS
SELECT
    a.id_agendamento,
    e.id_estabelecimento,
    e.nome_fantasia            AS estabelecimento,
    p.id_profissional,
    p.nome                     AS profissional,
    s.nome_servico             AS servico,
    u.nome_completo            AS cliente,
    a.data_hora_inicio,
    a.data_hora_fim,
    a.status_agendamento,
    a.metodo_pagamento,
    a.valor_final_cobrado,
    a.cashback_utilizado
FROM agendamento a
JOIN profissional p            ON p.id_profissional = a.id_profissional
JOIN estabelecimento e         ON e.id_estabelecimento = p.id_estabelecimento
LEFT JOIN carteira_usuario u   ON u.id_usuario = a.id_usuario
LEFT JOIN profissional_servico ps ON ps.id_profissional_servico = a.id_profissional_servico
LEFT JOIN servico s            ON s.id_servico = ps.id_servico;

-- Exemplo: agenda de hoje do estabelecimento 1
-- SELECT * FROM vw_agenda_detalhada
--  WHERE id_estabelecimento = 1 AND DATE(data_hora_inicio) = CURDATE()
--  ORDER BY data_hora_inicio;

-- ---------------------------------------------------------------------
-- VIEW 2: faturamento mensal por estabelecimento
-- Considera apenas atendimentos concluídos.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS vw_faturamento_mensal;
CREATE VIEW vw_faturamento_mensal AS
SELECT
    e.id_estabelecimento,
    e.nome_fantasia                         AS estabelecimento,
    DATE_FORMAT(a.data_hora_inicio, '%Y-%m') AS mes,
    COUNT(*)                                AS atendimentos_concluidos,
    COALESCE(SUM(a.valor_final_cobrado), 0) AS receita,
    COALESCE(SUM(a.cashback_utilizado), 0)  AS cashback_utilizado
FROM agendamento a
JOIN profissional p    ON p.id_profissional = a.id_profissional
JOIN estabelecimento e ON e.id_estabelecimento = p.id_estabelecimento
WHERE a.status_agendamento = 'CONCLUIDO'
GROUP BY e.id_estabelecimento, e.nome_fantasia, DATE_FORMAT(a.data_hora_inicio, '%Y-%m');

-- ---------------------------------------------------------------------
-- TRIGGER: gamificação ao avaliar
-- Ao registrar uma avaliação, o cliente do agendamento ganha 10 pontos
-- (+5 por cada selo positivo). Regra mantida no banco para valer em
-- qualquer forma de inserção (API, painel administrativo ou script).
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_avaliacao_pontos;
DELIMITER $$
CREATE TRIGGER trg_avaliacao_pontos
AFTER INSERT ON avaliacao
FOR EACH ROW
BEGIN
    UPDATE carteira_usuario u
    JOIN agendamento a ON a.id_usuario = u.id_usuario
    SET u.pontos_gamificacao = u.pontos_gamificacao
                               + 10
                               + IF(NEW.selo_servico, 5, 0)
                               + IF(NEW.selo_ambiente, 5, 0)
    WHERE a.id_agendamento = NEW.id_agendamento;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- TRIGGER: impede avaliar atendimento que não foi concluído
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_avaliacao_valida;
DELIMITER $$
CREATE TRIGGER trg_avaliacao_valida
BEFORE INSERT ON avaliacao
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(30);
    SELECT status_agendamento INTO v_status
      FROM agendamento WHERE id_agendamento = NEW.id_agendamento;
    IF v_status IS NULL OR v_status <> 'CONCLUIDO' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Só é possível avaliar atendimentos concluídos.';
    END IF;
END$$
DELIMITER ;

-- ---------------------------------------------------------------------
-- PROCEDURE: resumo do estabelecimento em uma data
-- Uso: CALL sp_resumo_estabelecimento(1, CURDATE());
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_resumo_estabelecimento;
DELIMITER $$
CREATE PROCEDURE sp_resumo_estabelecimento(
    IN p_id_estabelecimento INT,
    IN p_data DATE
)
BEGIN
    SELECT
        (SELECT COUNT(*) FROM profissional
          WHERE id_estabelecimento = p_id_estabelecimento
            AND status_ativo = TRUE)                              AS profissionais_ativos,
        (SELECT COUNT(*) FROM vw_agenda_detalhada
          WHERE id_estabelecimento = p_id_estabelecimento
            AND DATE(data_hora_inicio) = p_data
            AND status_agendamento = 'AGENDADO')                  AS reservas_do_dia,
        (SELECT COALESCE(SUM(receita), 0) FROM vw_faturamento_mensal
          WHERE id_estabelecimento = p_id_estabelecimento
            AND mes = DATE_FORMAT(p_data, '%Y-%m'))               AS receita_do_mes;
END$$
DELIMITER ;
