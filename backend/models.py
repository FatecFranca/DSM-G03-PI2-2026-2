import enum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DECIMAL,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class EstabelecimentoModel(Base):
    __tablename__ = "estabelecimento"
    __table_args__ = (
        CheckConstraint(
            "publico_alvo IN ('MASCULINO', 'FEMININO', 'AMBOS')",
            name="ck_estabelecimento_publico",
        ),
    )

    id_estabelecimento = Column(Integer, primary_key=True, autoincrement=True)
    nome_fantasia = Column(String(150), nullable=False)
    cnpj = Column(String(14), unique=True, nullable=True)
    categoria = Column(String(50), nullable=False)
    publico_alvo = Column(String(20), nullable=False, default="AMBOS")
    endereco_completo = Column(Text, nullable=False)
    latitude = Column(DECIMAL(9, 6), nullable=True)
    longitude = Column(DECIMAL(9, 6), nullable=True)
    saldo_devedor = Column(DECIMAL(8, 2), nullable=False, default=0)
    status_ativo = Column(Boolean, nullable=False, default=True)
    data_cadastro = Column(DateTime, nullable=False, server_default=func.now())

    profissionais = relationship("ProfissionalModel", back_populates="estabelecimento")
    conta = relationship("ContaEstabelecimentoModel", back_populates="estabelecimento", uselist=False)


class ContaEstabelecimentoModel(Base):
    __tablename__ = "conta_estabelecimento"

    id_conta = Column(Integer, primary_key=True, autoincrement=True)
    id_estabelecimento = Column(
        Integer,
        ForeignKey("estabelecimento.id_estabelecimento", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    email = Column(String(254), nullable=False, unique=True)
    senha_hash = Column(String(255), nullable=False)

    estabelecimento = relationship("EstabelecimentoModel", back_populates="conta")


class ProfissionalModel(Base):
    __tablename__ = "profissional"

    id_profissional = Column(Integer, primary_key=True, autoincrement=True)
    id_estabelecimento = Column(
        Integer,
        ForeignKey("estabelecimento.id_estabelecimento", ondelete="RESTRICT"),
        nullable=False,
    )
    nome = Column(String(150), nullable=False)
    cpf = Column(String(11), unique=True, nullable=False)
    status_ativo = Column(Boolean, nullable=False, default=True)
    eh_dono = Column(Boolean, nullable=False, default=False)

    estabelecimento = relationship("EstabelecimentoModel", back_populates="profissionais")
    servicos = relationship("ProfissionalServicoModel", back_populates="profissional")


class ServicoModel(Base):
    __tablename__ = "servico"
    __table_args__ = (
        CheckConstraint(
            "duracao_estimada_minutos BETWEEN 1 AND 480",
            name="ck_servico_duracao",
        ),
    )

    id_servico = Column(Integer, primary_key=True, autoincrement=True)
    nome_servico = Column(String(100), nullable=False)
    descricao = Column(Text, nullable=True)
    duracao_estimada_minutos = Column(Integer, nullable=False)

    profissionais_vinculados = relationship("ProfissionalServicoModel", back_populates="servico")


class ProfissionalServicoModel(Base):
    __tablename__ = "profissional_servico"
    __table_args__ = (
        UniqueConstraint("id_profissional", "id_servico", name="uk_profissional_servico"),
        CheckConstraint("preco IS NULL OR preco > 0", name="ck_profissional_servico_preco"),
    )

    id_profissional_servico = Column(Integer, primary_key=True, autoincrement=True)
    id_profissional = Column(
        Integer,
        ForeignKey("profissional.id_profissional", ondelete="CASCADE"),
        nullable=False,
    )
    id_servico = Column(
        Integer,
        ForeignKey("servico.id_servico", ondelete="CASCADE"),
        nullable=False,
    )
    preco = Column(DECIMAL(8, 2), nullable=True)

    profissional = relationship("ProfissionalModel", back_populates="servicos")
    servico = relationship("ServicoModel", back_populates="profissionais_vinculados")


class CarteiraUsuarioModel(Base):
    __tablename__ = "carteira_usuario"
    __table_args__ = (
        CheckConstraint(
            "preferencia_publico IN ('MASCULINO', 'FEMININO', 'AMBOS')",
            name="ck_usuario_publico",
        ),
        CheckConstraint("saldo_cashback >= 0", name="ck_usuario_cashback"),
        CheckConstraint("pontos_gamificacao >= 0", name="ck_usuario_pontos"),
    )

    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    nome_completo = Column(String(150), nullable=False)
    email = Column(String(254), nullable=False, unique=True)
    senha_hash = Column(String(255), nullable=False)
    preferencia_publico = Column(String(20), nullable=False, default="AMBOS")
    saldo_cashback = Column(DECIMAL(8, 2), nullable=False, default=0)
    pontos_gamificacao = Column(Integer, nullable=False, default=0)
    status_ativo = Column(Boolean, nullable=False, default=True)
    data_cadastro = Column(DateTime, nullable=False, server_default=func.now())


class PlanoModel(Base):
    __tablename__ = "plano"
    __table_args__ = (
        CheckConstraint("preco_mensal > 0", name="ck_plano_preco"),
        CheckConstraint("qtd_servico_mes > 0", name="ck_plano_servicos"),
    )

    id_plano = Column(Integer, primary_key=True, autoincrement=True)
    id_estabelecimento = Column(
        Integer,
        ForeignKey("estabelecimento.id_estabelecimento", ondelete="CASCADE"),
        nullable=False,
    )
    id_profissional = Column(
        Integer,
        ForeignKey("profissional.id_profissional", ondelete="CASCADE"),
        nullable=True,
    )
    nome_plano = Column(String(100), nullable=False)
    preco_mensal = Column(DECIMAL(8, 2), nullable=False)
    qtd_servico_mes = Column(Integer, nullable=False)


class OfertaPlanoModel(Base):
    __tablename__ = "oferta_plano"
    __table_args__ = (
        UniqueConstraint("id_estabelecimento", "id_plano", name="uk_estabelecimento_plano"),
    )

    id_oferta_plano = Column(Integer, primary_key=True, autoincrement=True)
    id_estabelecimento = Column(
        Integer,
        ForeignKey("estabelecimento.id_estabelecimento", ondelete="CASCADE"),
        nullable=False,
    )
    id_plano = Column(
        Integer,
        ForeignKey("plano.id_plano", ondelete="RESTRICT"),
        nullable=False,
    )
    status_ativo = Column(Boolean, nullable=False, default=True)
    comissao_local = Column(DECIMAL(5, 2), nullable=True)


class AssinaturaAtivaModel(Base):
    __tablename__ = "assinatura_ativa"
    __table_args__ = (
        UniqueConstraint("id_usuario", "id_plano", name="uk_usuario_plano"),
        CheckConstraint("servicos_restantes >= 0", name="ck_assinatura_servicos_restantes"),
    )

    id_assinatura = Column(Integer, primary_key=True, autoincrement=True)
    id_usuario = Column(
        Integer,
        ForeignKey("carteira_usuario.id_usuario", ondelete="CASCADE"),
        nullable=False,
    )
    id_plano = Column(
        Integer,
        ForeignKey("plano.id_plano", ondelete="RESTRICT"),
        nullable=False,
    )
    servicos_restantes = Column(Integer, nullable=False)
    data_renovacao = Column(Date, nullable=False)
    status_pagamento = Column(String(30), nullable=False, default="AGUARDANDO_PAGAMENTO")


class StatusAgendamentoEnum(str, enum.Enum):
    AGENDADO = "AGENDADO"
    BLOQUEIO_MANUAL = "BLOQUEIO_MANUAL"
    CONCLUIDO = "CONCLUIDO"
    CANCELADO = "CANCELADO"
    NO_SHOW = "NO_SHOW"


class MetodoPagamentoEnum(str, enum.Enum):
    PIX = "PIX"
    CARTAO_CREDITO = "CARTAO_CREDITO"
    DINHEIRO = "DINHEIRO"
    ASSINATURA = "ASSINATURA"
    BLOQUEIO = "BLOQUEIO"


class AgendamentoModel(Base):
    __tablename__ = "agendamento"
    __table_args__ = (
        CheckConstraint("data_hora_fim > data_hora_inicio", name="ck_agendamento_intervalo"),
        CheckConstraint("cashback_utilizado >= 0", name="ck_agendamento_cashback"),
        CheckConstraint(
            "status_agendamento IN "
            "('AGENDADO', 'BLOQUEIO_MANUAL', 'CONCLUIDO', 'CANCELADO', 'NO_SHOW')",
            name="ck_agendamento_status",
        ),
        CheckConstraint(
            "metodo_pagamento IN "
            "('PIX', 'CARTAO_CREDITO', 'DINHEIRO', 'ASSINATURA', 'BLOQUEIO')",
            name="ck_agendamento_pagamento",
        ),
        Index("ix_agendamento_profissional_inicio", "id_profissional", "data_hora_inicio"),
        Index("ix_agendamento_usuario_inicio", "id_usuario", "data_hora_inicio"),
    )

    id_agendamento = Column(Integer, primary_key=True, autoincrement=True)
    id_profissional = Column(
        Integer,
        ForeignKey("profissional.id_profissional", ondelete="RESTRICT"),
        nullable=False,
    )
    id_usuario = Column(
        Integer,
        ForeignKey("carteira_usuario.id_usuario", ondelete="SET NULL"),
        nullable=True,
    )
    id_profissional_servico = Column(
        Integer,
        ForeignKey("profissional_servico.id_profissional_servico", ondelete="SET NULL"),
        nullable=True,
    )
    data_hora_inicio = Column(DateTime, nullable=False)
    data_hora_fim = Column(DateTime, nullable=False)
    status_agendamento = Column(String(30), nullable=False, default="AGENDADO")
    metodo_pagamento = Column(String(30), nullable=False, default="PIX")
    valor_final_cobrado = Column(DECIMAL(8, 2), nullable=True)
    cashback_utilizado = Column(DECIMAL(8, 2), nullable=False, default=0)


class AvaliacaoModel(Base):
    __tablename__ = "avaliacao"

    id_avaliacao = Column(Integer, primary_key=True, autoincrement=True)
    id_agendamento = Column(
        Integer,
        ForeignKey("agendamento.id_agendamento", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    selo_servico = Column(Boolean, nullable=False, default=False)
    selo_ambiente = Column(Boolean, nullable=False, default=False)
    critica_privada = Column(Text, nullable=True)
    cashback_liberado = Column(Boolean, nullable=False, default=False)
