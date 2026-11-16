import re
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Publico = Literal["MASCULINO", "FEMININO", "AMBOS"]
Pagamento = Literal["PIX", "CARTAO_CREDITO", "DINHEIRO", "ASSINATURA"]


def normalizar_email(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
        raise ValueError("Informe um e-mail válido.")
    return normalized


class ApiSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class LoginRequest(ApiSchema):
    email: str = Field(min_length=5, max_length=254)
    senha: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validar_email(self):
        self.email = normalizar_email(self.email)
        return self


class TokenResponse(ApiSchema):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UsuarioCreate(ApiSchema):
    nome_completo: str = Field(min_length=3, max_length=150)
    email: str = Field(min_length=5, max_length=254)
    senha: str = Field(min_length=8, max_length=128)
    preferencia_publico: Publico = "AMBOS"

    @model_validator(mode="after")
    def validar_email(self):
        self.email = normalizar_email(self.email)
        return self


class UsuarioResponse(ApiSchema):
    id_usuario: int
    nome_completo: str
    email: str
    preferencia_publico: str
    saldo_cashback: Decimal
    pontos_gamificacao: int
    status_ativo: bool


class EstabelecimentoBase(ApiSchema):
    nome_fantasia: str = Field(min_length=3, max_length=150)
    cnpj: str | None = Field(default=None, min_length=14, max_length=14, pattern=r"^\d{14}$")
    categoria: str = Field(default="Barbearia", min_length=2, max_length=50)
    publico_alvo: Publico = "AMBOS"
    endereco_completo: str = Field(min_length=10, max_length=500)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90, max_digits=9, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, max_digits=9, decimal_places=6)


class EstabelecimentoCreate(EstabelecimentoBase):
    pass


class EstabelecimentoRegistro(EstabelecimentoBase):
    email: str = Field(min_length=5, max_length=254)
    senha: str = Field(min_length=8, max_length=128)
    responsavel_nome: str = Field(min_length=3, max_length=150)
    responsavel_cpf: str = Field(min_length=11, max_length=11, pattern=r"^\d{11}$")

    @model_validator(mode="after")
    def validar_email(self):
        self.email = normalizar_email(self.email)
        return self


class EstabelecimentoResponse(EstabelecimentoBase):
    id_estabelecimento: int
    saldo_devedor: Decimal
    status_ativo: bool


class EstabelecimentoUpdate(ApiSchema):
    nome_fantasia: str | None = Field(default=None, min_length=3, max_length=150)
    categoria: str | None = Field(default=None, min_length=2, max_length=50)
    publico_alvo: Publico | None = None
    endereco_completo: str | None = Field(default=None, min_length=10, max_length=500)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90, max_digits=9, decimal_places=6)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180, max_digits=9, decimal_places=6)


class ProfissionalCreate(ApiSchema):
    nome: str = Field(min_length=3, max_length=150)
    cpf: str = Field(min_length=11, max_length=11, pattern=r"^\d{11}$")


class ProfissionalResponse(ApiSchema):
    id_profissional: int
    id_estabelecimento: int
    nome: str
    cpf: str
    status_ativo: bool
    eh_dono: bool


class ProfissionalStatusUpdate(ApiSchema):
    status_ativo: bool


class ServicoCreate(ApiSchema):
    nome_servico: str = Field(min_length=2, max_length=100)
    descricao: str | None = Field(default=None, max_length=2000)
    duracao_estimada_minutos: int = Field(gt=0, le=480)


class ServicoCadastro(ServicoCreate):
    id_profissional: int
    preco: Decimal = Field(gt=0, max_digits=8, decimal_places=2)


class ServicoResponse(ServicoCreate):
    id_servico: int


class BloqueioCreate(ApiSchema):
    id_profissional: int
    data_hora_inicio: datetime
    data_hora_fim: datetime

    @model_validator(mode="after")
    def validar_intervalo(self):
        if self.data_hora_inicio.tzinfo is not None or self.data_hora_fim.tzinfo is not None:
            raise ValueError("Use horário local sem informação de fuso horário.")
        if self.data_hora_inicio <= datetime.now():
            raise ValueError("O bloqueio precisa começar no futuro.")
        if self.data_hora_fim <= self.data_hora_inicio:
            raise ValueError("O fim do bloqueio precisa ser posterior ao início.")
        return self


class ProfissionalServicoCreate(ApiSchema):
    id_profissional: int
    id_servico: int
    preco: Decimal = Field(gt=0, max_digits=8, decimal_places=2)


class ServicoDisponivel(ApiSchema):
    id_profissional_servico: int
    id_estabelecimento: int
    nome_estabelecimento: str
    endereco_completo: str
    id_profissional: int
    profissional: str
    id_servico: int
    nome_servico: str
    descricao: str | None
    duracao_estimada_minutos: int
    preco: Decimal


class AgendamentoCreate(ApiSchema):
    id_profissional_servico: int
    data_hora_inicio: datetime
    metodo_pagamento: Pagamento
    cashback_utilizado: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=8, decimal_places=2)

    @model_validator(mode="after")
    def validar_inicio_futuro(self):
        if self.data_hora_inicio.tzinfo is not None:
            raise ValueError("Use horário local sem informação de fuso horário.")
        if self.data_hora_inicio <= datetime.now():
            raise ValueError("O horário do agendamento precisa estar no futuro.")
        return self


class AgendamentoResponse(ApiSchema):
    id_agendamento: int
    id_profissional: int
    id_usuario: int | None
    id_profissional_servico: int | None
    data_hora_inicio: datetime
    data_hora_fim: datetime
    status_agendamento: str
    metodo_pagamento: str
    valor_final_cobrado: Decimal | None
    cashback_utilizado: Decimal


class AgendamentoPainel(AgendamentoResponse):
    cliente: str | None
    profissional: str
    nome_servico: str | None


class AgendamentoCliente(AgendamentoResponse):
    profissional: str
    nome_servico: str | None


class AgendamentoStatusUpdate(ApiSchema):
    status_agendamento: Literal["CONCLUIDO", "CANCELADO", "NO_SHOW"]


class EstabelecimentoResumo(ApiSchema):
    estabelecimento: EstabelecimentoResponse
    profissionais_ativos: int
    agendamentos_hoje: int
    receita_mes: Decimal
