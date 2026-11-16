import logging
import os
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Annotated

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

import models
import schemas
from database import Base, engine, get_db
from security import create_access_token, decode_access_token, hash_password, verify_password


logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Kalix API",
    description="API de descoberta e agendamento para clientes e estabelecimentos.",
    version="1.0.0",
    lifespan=lifespan,
)
allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def get_principal(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = decode_access_token(credentials.credentials)
        role = claims.get("role")
        subject = int(claims.get("sub", ""))
        if role not in {"cliente", "estabelecimento"}:
            raise ValueError("Perfil inválido.")
        return {"id": subject, "role": role}
    except (jwt.InvalidTokenError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Entre novamente.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None


def get_cliente_id(
    principal: Annotated[dict, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> int:
    if principal["role"] != "cliente":
        raise HTTPException(status_code=403, detail="Acesso exclusivo para clientes.")
    usuario = db.get(models.CarteiraUsuarioModel, principal["id"])
    if usuario is None or not usuario.status_ativo:
        raise HTTPException(status_code=401, detail="Conta de cliente indisponível.")
    return usuario.id_usuario


def get_estabelecimento_id(
    principal: Annotated[dict, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
) -> int:
    if principal["role"] != "estabelecimento":
        raise HTTPException(status_code=403, detail="Acesso exclusivo para estabelecimentos.")
    estabelecimento = db.get(models.EstabelecimentoModel, principal["id"])
    conta = (
        db.query(models.ContaEstabelecimentoModel)
        .filter_by(id_estabelecimento=principal["id"])
        .first()
    )
    if estabelecimento is None or conta is None or not estabelecimento.status_ativo:
        raise HTTPException(status_code=401, detail="Conta do estabelecimento indisponível.")
    return estabelecimento.id_estabelecimento


def responder_erro_integridade(db: Session, mensagem: str) -> None:
    db.rollback()
    raise HTTPException(status_code=409, detail=mensagem)


def encerrar_transacao_com_erro(db: Session, operacao: str) -> None:
    db.rollback()
    logger.exception("Falha de banco durante %s", operacao)
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Não foi possível concluir a operação. Tente novamente.",
    )


def montar_token(subject: int, role: str, user: dict) -> schemas.TokenResponse:
    return schemas.TokenResponse(
        access_token=create_access_token(subject, role),
        user=user,
    )


@app.get("/health", tags=["infraestrutura"])
def health_check(db: Annotated[Session, Depends(get_db)]):
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Verificação do banco falhou")
        raise HTTPException(status_code=503, detail="Banco de dados indisponível.") from None
    return {"status": "online", "database": "online"}


@app.post(
    "/auth/clientes/register",
    response_model=schemas.TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["autenticação"],
)
def registrar_cliente(
    payload: schemas.UsuarioCreate,
    db: Annotated[Session, Depends(get_db)],
):
    usuario = models.CarteiraUsuarioModel(
        nome_completo=payload.nome_completo,
        email=payload.email,
        senha_hash=hash_password(payload.senha),
        preferencia_publico=payload.preferencia_publico,
    )
    db.add(usuario)
    try:
        db.commit()
        db.refresh(usuario)
    except IntegrityError:
        responder_erro_integridade(db, "Este e-mail já está cadastrado.")
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "cadastro de cliente")
    return montar_token(
        usuario.id_usuario,
        "cliente",
        {
            "id": usuario.id_usuario,
            "nome": usuario.nome_completo,
            "email": usuario.email,
            "perfil": "cliente",
        },
    )


@app.post("/auth/clientes/login", response_model=schemas.TokenResponse, tags=["autenticação"])
def login_cliente(payload: schemas.LoginRequest, db: Annotated[Session, Depends(get_db)]):
    usuario = (
        db.query(models.CarteiraUsuarioModel)
        .filter(func.lower(models.CarteiraUsuarioModel.email) == payload.email)
        .first()
    )
    if (
        usuario is None
        or not usuario.status_ativo
        or not verify_password(payload.senha, usuario.senha_hash)
    ):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    return montar_token(
        usuario.id_usuario,
        "cliente",
        {
            "id": usuario.id_usuario,
            "nome": usuario.nome_completo,
            "email": usuario.email,
            "perfil": "cliente",
        },
    )


@app.post(
    "/auth/estabelecimentos/register",
    response_model=schemas.TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["autenticação"],
)
def registrar_estabelecimento(
    payload: schemas.EstabelecimentoRegistro,
    db: Annotated[Session, Depends(get_db)],
):
    dados = payload.model_dump(
        exclude={"email", "senha", "responsavel_nome", "responsavel_cpf"}
    )
    estabelecimento = models.EstabelecimentoModel(**dados)
    try:
        db.add(estabelecimento)
        db.flush()
        conta = models.ContaEstabelecimentoModel(
            id_estabelecimento=estabelecimento.id_estabelecimento,
            email=payload.email,
            senha_hash=hash_password(payload.senha),
        )
        responsavel = models.ProfissionalModel(
            id_estabelecimento=estabelecimento.id_estabelecimento,
            nome=payload.responsavel_nome,
            cpf=payload.responsavel_cpf,
            status_ativo=True,
            eh_dono=True,
        )
        db.add_all([conta, responsavel])
        db.commit()
        db.refresh(estabelecimento)
    except IntegrityError:
        responder_erro_integridade(
            db,
            "E-mail, CPF ou CNPJ já cadastrado. Verifique os dados informados.",
        )
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "cadastro de estabelecimento")
    return montar_token(
        estabelecimento.id_estabelecimento,
        "estabelecimento",
        {
            "id": estabelecimento.id_estabelecimento,
            "nome": estabelecimento.nome_fantasia,
            "email": payload.email,
            "perfil": "estabelecimento",
        },
    )


@app.post(
    "/auth/estabelecimentos/login",
    response_model=schemas.TokenResponse,
    tags=["autenticação"],
)
def login_estabelecimento(
    payload: schemas.LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    conta = (
        db.query(models.ContaEstabelecimentoModel)
        .filter(func.lower(models.ContaEstabelecimentoModel.email) == payload.email)
        .first()
    )
    if conta is None or not verify_password(payload.senha, conta.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    estabelecimento = db.get(models.EstabelecimentoModel, conta.id_estabelecimento)
    if estabelecimento is None or not estabelecimento.status_ativo:
        raise HTTPException(status_code=401, detail="Conta do estabelecimento indisponível.")
    return montar_token(
        estabelecimento.id_estabelecimento,
        "estabelecimento",
        {
            "id": estabelecimento.id_estabelecimento,
            "nome": estabelecimento.nome_fantasia,
            "email": conta.email,
            "perfil": "estabelecimento",
        },
    )


@app.get(
    "/estabelecimentos",
    response_model=list[schemas.EstabelecimentoResponse],
    tags=["estabelecimentos"],
)
def listar_estabelecimentos(
    db: Annotated[Session, Depends(get_db)],
    nome: str | None = Query(default=None, max_length=100),
    publico_alvo: schemas.Publico | None = None,
):
    query = db.query(models.EstabelecimentoModel).filter(
        models.EstabelecimentoModel.status_ativo.is_(True)
    )
    if nome and nome.strip():
        query = query.filter(models.EstabelecimentoModel.nome_fantasia.ilike(f"%{nome.strip()}%"))
    if publico_alvo and publico_alvo != "AMBOS":
        query = query.filter(
            models.EstabelecimentoModel.publico_alvo.in_([publico_alvo, "AMBOS"])
        )
    return query.order_by(models.EstabelecimentoModel.nome_fantasia).limit(100).all()


@app.get(
    "/estabelecimentos/{id_estabelecimento}",
    response_model=schemas.EstabelecimentoResponse,
    tags=["estabelecimentos"],
)
def obter_estabelecimento(
    id_estabelecimento: int,
    db: Annotated[Session, Depends(get_db)],
):
    estabelecimento = db.get(models.EstabelecimentoModel, id_estabelecimento)
    if estabelecimento is None or not estabelecimento.status_ativo:
        raise HTTPException(status_code=404, detail="Estabelecimento não encontrado.")
    return estabelecimento


@app.get("/catalogo", response_model=list[schemas.ServicoDisponivel], tags=["catálogo"])
def listar_catalogo(
    db: Annotated[Session, Depends(get_db)],
    id_estabelecimento: int | None = None,
    nome: str | None = Query(default=None, max_length=100),
):
    query = (
        db.query(
            models.ProfissionalServicoModel.id_profissional_servico,
            models.EstabelecimentoModel.id_estabelecimento,
            models.EstabelecimentoModel.nome_fantasia.label("nome_estabelecimento"),
            models.EstabelecimentoModel.endereco_completo,
            models.ProfissionalModel.id_profissional,
            models.ProfissionalModel.nome.label("profissional"),
            models.ServicoModel.id_servico,
            models.ServicoModel.nome_servico,
            models.ServicoModel.descricao,
            models.ServicoModel.duracao_estimada_minutos,
            models.ProfissionalServicoModel.preco,
        )
        .join(
            models.ProfissionalModel,
            models.ProfissionalServicoModel.id_profissional
            == models.ProfissionalModel.id_profissional,
        )
        .join(
            models.ServicoModel,
            models.ProfissionalServicoModel.id_servico == models.ServicoModel.id_servico,
        )
        .join(
            models.EstabelecimentoModel,
            models.ProfissionalModel.id_estabelecimento
            == models.EstabelecimentoModel.id_estabelecimento,
        )
        .filter(
            models.ProfissionalModel.status_ativo.is_(True),
            models.EstabelecimentoModel.status_ativo.is_(True),
            models.ProfissionalServicoModel.preco.is_not(None),
            models.ProfissionalServicoModel.preco > 0,
        )
    )
    if id_estabelecimento is not None:
        query = query.filter(
            models.ProfissionalModel.id_estabelecimento == id_estabelecimento
        )
    if nome and nome.strip():
        term = f"%{nome.strip()}%"
        query = query.filter(
            or_(
                models.ServicoModel.nome_servico.ilike(term),
                models.ProfissionalModel.nome.ilike(term),
                models.EstabelecimentoModel.nome_fantasia.ilike(term),
            )
        )
    return [
        schemas.ServicoDisponivel.model_validate(row._asdict())
        for row in query.order_by(models.EstabelecimentoModel.nome_fantasia).limit(200).all()
    ]


@app.get(
    "/profissionais",
    response_model=list[schemas.ProfissionalResponse],
    tags=["profissionais"],
)
def listar_profissionais(
    db: Annotated[Session, Depends(get_db)],
    id_estabelecimento: int | None = None,
):
    query = db.query(models.ProfissionalModel).join(models.EstabelecimentoModel).filter(
        models.ProfissionalModel.status_ativo.is_(True),
        models.EstabelecimentoModel.status_ativo.is_(True),
    )
    if id_estabelecimento is not None:
        query = query.filter(models.ProfissionalModel.id_estabelecimento == id_estabelecimento)
    return query.order_by(models.ProfissionalModel.nome).all()


@app.get("/servicos", response_model=list[schemas.ServicoResponse], tags=["catálogo"])
def listar_servicos(db: Annotated[Session, Depends(get_db)]):
    return db.query(models.ServicoModel).order_by(models.ServicoModel.nome_servico).all()


@app.get("/me", tags=["autenticação"])
def obter_perfil(
    principal: Annotated[dict, Depends(get_principal)],
    db: Annotated[Session, Depends(get_db)],
):
    if principal["role"] == "cliente":
        usuario = db.get(models.CarteiraUsuarioModel, principal["id"])
        if usuario is None or not usuario.status_ativo:
            raise HTTPException(status_code=401, detail="Conta de cliente indisponível.")
        return {
            "id": usuario.id_usuario,
            "nome": usuario.nome_completo,
            "email": usuario.email,
            "perfil": "cliente",
            "saldo_cashback": usuario.saldo_cashback,
            "pontos_gamificacao": usuario.pontos_gamificacao,
        }
    estabelecimento = db.get(models.EstabelecimentoModel, principal["id"])
    if estabelecimento is None or not estabelecimento.status_ativo:
        raise HTTPException(status_code=401, detail="Conta do estabelecimento indisponível.")
    return {
        "id": estabelecimento.id_estabelecimento,
        "nome": estabelecimento.nome_fantasia,
        "perfil": "estabelecimento",
    }


@app.get(
    "/minha-conta/agendamentos",
    response_model=list[schemas.AgendamentoCliente],
    tags=["agendamentos"],
)
def listar_meus_agendamentos(
    cliente_id: Annotated[int, Depends(get_cliente_id)],
    db: Annotated[Session, Depends(get_db)],
):
    rows = (
        db.query(
            models.AgendamentoModel,
            models.ProfissionalModel.nome.label("profissional"),
            models.ServicoModel.nome_servico.label("nome_servico"),
        )
        .join(models.ProfissionalModel)
        .outerjoin(
            models.ProfissionalServicoModel,
            models.AgendamentoModel.id_profissional_servico
            == models.ProfissionalServicoModel.id_profissional_servico,
        )
        .outerjoin(
            models.ServicoModel,
            models.ProfissionalServicoModel.id_servico == models.ServicoModel.id_servico,
        )
        .filter(models.AgendamentoModel.id_usuario == cliente_id)
        .order_by(models.AgendamentoModel.data_hora_inicio.desc())
        .limit(100)
        .all()
    )
    return [
        schemas.AgendamentoCliente(
            **schemas.AgendamentoResponse.model_validate(row[0]).model_dump(),
            profissional=row.profissional,
            nome_servico=row.nome_servico,
        )
        for row in rows
    ]


@app.post(
    "/agendamentos",
    response_model=schemas.AgendamentoResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["agendamentos"],
)
def criar_agendamento(
    payload: schemas.AgendamentoCreate,
    cliente_id: Annotated[int, Depends(get_cliente_id)],
    db: Annotated[Session, Depends(get_db)],
):
    vinculo = db.get(models.ProfissionalServicoModel, payload.id_profissional_servico)
    if vinculo is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    profissional = (
        db.query(models.ProfissionalModel)
        .filter_by(id_profissional=vinculo.id_profissional, status_ativo=True)
        .with_for_update()
        .first()
    )
    if profissional is None:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    estabelecimento = db.get(models.EstabelecimentoModel, profissional.id_estabelecimento)
    if estabelecimento is None or not estabelecimento.status_ativo:
        raise HTTPException(status_code=404, detail="Estabelecimento indisponível.")

    servico = db.get(models.ServicoModel, vinculo.id_servico)
    if servico is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    if vinculo.preco is None or vinculo.preco <= 0:
        raise HTTPException(status_code=409, detail="O preço deste serviço ainda não foi definido.")
    inicio = payload.data_hora_inicio
    fim = inicio + timedelta(minutes=servico.duracao_estimada_minutos)
    preco = Decimal(vinculo.preco)
    limite_cashback = (preco * Decimal("0.30")).quantize(Decimal("0.01"))
    if payload.cashback_utilizado > limite_cashback:
        raise HTTPException(
            status_code=422,
            detail=f"O cashback não pode ultrapassar 30% do serviço (R$ {limite_cashback}).",
        )

    usuario = db.get(models.CarteiraUsuarioModel, cliente_id)
    if usuario is None:
        raise HTTPException(status_code=401, detail="Conta de cliente indisponível.")
    if payload.cashback_utilizado > usuario.saldo_cashback:
        raise HTTPException(status_code=400, detail="Saldo de cashback insuficiente.")
    if payload.metodo_pagamento == "ASSINATURA":
        raise HTTPException(
            status_code=422,
            detail="Pagamento por assinatura ainda não está disponível.",
        )

    conflito = (
        db.query(models.AgendamentoModel.id_agendamento)
        .filter(
            models.AgendamentoModel.id_profissional == profissional.id_profissional,
            models.AgendamentoModel.status_agendamento != "CANCELADO",
            models.AgendamentoModel.data_hora_inicio < fim,
            models.AgendamentoModel.data_hora_fim > inicio,
        )
        .first()
    )
    if conflito:
        raise HTTPException(status_code=409, detail="Este horário acabou de ser reservado.")

    agendamento = models.AgendamentoModel(
        id_profissional=profissional.id_profissional,
        id_usuario=cliente_id,
        id_profissional_servico=vinculo.id_profissional_servico,
        data_hora_inicio=inicio,
        data_hora_fim=fim,
        status_agendamento="AGENDADO",
        metodo_pagamento=payload.metodo_pagamento,
        valor_final_cobrado=preco - payload.cashback_utilizado,
        cashback_utilizado=payload.cashback_utilizado,
    )
    usuario.saldo_cashback -= payload.cashback_utilizado
    db.add(agendamento)
    try:
        db.commit()
        db.refresh(agendamento)
    except IntegrityError:
        responder_erro_integridade(db, "Não foi possível reservar este horário.")
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "criação de agendamento")
    return agendamento


@app.patch(
    "/minha-conta/agendamentos/{id_agendamento}/cancelar",
    response_model=schemas.AgendamentoResponse,
    tags=["agendamentos"],
)
def cancelar_agendamento_cliente(
    id_agendamento: int,
    cliente_id: Annotated[int, Depends(get_cliente_id)],
    db: Annotated[Session, Depends(get_db)],
):
    agendamento = (
        db.query(models.AgendamentoModel)
        .filter_by(id_agendamento=id_agendamento, id_usuario=cliente_id)
        .with_for_update()
        .first()
    )
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    if agendamento.status_agendamento != "AGENDADO":
        raise HTTPException(status_code=409, detail="Este agendamento não pode ser cancelado.")
    if agendamento.data_hora_inicio <= datetime.now():
        raise HTTPException(status_code=409, detail="Não é possível cancelar um horário já iniciado.")
    agendamento.status_agendamento = "CANCELADO"
    usuario = db.get(models.CarteiraUsuarioModel, cliente_id)
    if usuario is not None:
        usuario.saldo_cashback += agendamento.cashback_utilizado
    try:
        db.commit()
        db.refresh(agendamento)
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "cancelamento de agendamento")
    return agendamento


@app.get(
    "/painel/resumo",
    response_model=schemas.EstabelecimentoResumo,
    tags=["painel"],
)
def resumo_estabelecimento(
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    estabelecimento = db.get(models.EstabelecimentoModel, estabelecimento_id)
    hoje = date.today()
    inicio_dia = datetime.combine(hoje, time.min)
    fim_dia = inicio_dia + timedelta(days=1)
    inicio_mes = datetime.combine(hoje.replace(day=1), time.min)
    profissionais_ativos = (
        db.query(func.count(models.ProfissionalModel.id_profissional))
        .filter(
            models.ProfissionalModel.id_estabelecimento == estabelecimento_id,
            models.ProfissionalModel.status_ativo.is_(True),
        )
        .scalar()
        or 0
    )
    agendamentos_hoje = (
        db.query(func.count(models.AgendamentoModel.id_agendamento))
        .join(models.ProfissionalModel)
        .filter(
            models.ProfissionalModel.id_estabelecimento == estabelecimento_id,
            models.AgendamentoModel.data_hora_inicio >= inicio_dia,
            models.AgendamentoModel.data_hora_inicio < fim_dia,
            models.AgendamentoModel.status_agendamento == "AGENDADO",
        )
        .scalar()
        or 0
    )
    receita_mes = (
        db.query(func.coalesce(func.sum(models.AgendamentoModel.valor_final_cobrado), 0))
        .join(models.ProfissionalModel)
        .filter(
            models.ProfissionalModel.id_estabelecimento == estabelecimento_id,
            models.AgendamentoModel.data_hora_inicio >= inicio_mes,
            models.AgendamentoModel.status_agendamento == "CONCLUIDO",
        )
        .scalar()
        or Decimal("0")
    )
    return {
        "estabelecimento": estabelecimento,
        "profissionais_ativos": profissionais_ativos,
        "agendamentos_hoje": agendamentos_hoje,
        "receita_mes": receita_mes,
    }


@app.patch(
    "/painel/estabelecimento",
    response_model=schemas.EstabelecimentoResponse,
    tags=["painel"],
)
def atualizar_estabelecimento(
    payload: schemas.EstabelecimentoUpdate,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    estabelecimento = db.get(models.EstabelecimentoModel, estabelecimento_id)
    for campo, valor in payload.model_dump(exclude_unset=True).items():
        setattr(estabelecimento, campo, valor)
    try:
        db.commit()
        db.refresh(estabelecimento)
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "atualização do estabelecimento")
    return estabelecimento


@app.get(
    "/painel/profissionais",
    response_model=list[schemas.ProfissionalResponse],
    tags=["painel"],
)
def listar_profissionais_painel(
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    return (
        db.query(models.ProfissionalModel)
        .filter_by(id_estabelecimento=estabelecimento_id)
        .order_by(models.ProfissionalModel.nome)
        .all()
    )


@app.post(
    "/painel/profissionais",
    response_model=schemas.ProfissionalResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["painel"],
)
def cadastrar_profissional(
    payload: schemas.ProfissionalCreate,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    profissional = models.ProfissionalModel(
        id_estabelecimento=estabelecimento_id,
        nome=payload.nome,
        cpf=payload.cpf,
    )
    db.add(profissional)
    try:
        db.commit()
        db.refresh(profissional)
    except IntegrityError:
        responder_erro_integridade(db, "Este CPF já está cadastrado.")
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "cadastro de profissional")
    return profissional


@app.patch(
    "/painel/profissionais/{id_profissional}",
    response_model=schemas.ProfissionalResponse,
    tags=["painel"],
)
def atualizar_status_profissional(
    id_profissional: int,
    payload: schemas.ProfissionalStatusUpdate,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    profissional = (
        db.query(models.ProfissionalModel)
        .filter_by(
            id_profissional=id_profissional,
            id_estabelecimento=estabelecimento_id,
        )
        .first()
    )
    if profissional is None:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    profissional.status_ativo = payload.status_ativo
    try:
        db.commit()
        db.refresh(profissional)
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "atualização de profissional")
    return profissional


@app.post(
    "/painel/bloqueios",
    response_model=schemas.AgendamentoResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["painel"],
)
def criar_bloqueio(
    payload: schemas.BloqueioCreate,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    profissional = (
        db.query(models.ProfissionalModel)
        .filter_by(
            id_profissional=payload.id_profissional,
            id_estabelecimento=estabelecimento_id,
            status_ativo=True,
        )
        .with_for_update()
        .first()
    )
    if profissional is None:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    conflito = (
        db.query(models.AgendamentoModel.id_agendamento)
        .filter(
            models.AgendamentoModel.id_profissional == profissional.id_profissional,
            models.AgendamentoModel.status_agendamento != "CANCELADO",
            models.AgendamentoModel.data_hora_inicio < payload.data_hora_fim,
            models.AgendamentoModel.data_hora_fim > payload.data_hora_inicio,
        )
        .first()
    )
    if conflito:
        raise HTTPException(status_code=409, detail="Este horário já está ocupado.")
    bloqueio = models.AgendamentoModel(
        id_profissional=profissional.id_profissional,
        data_hora_inicio=payload.data_hora_inicio,
        data_hora_fim=payload.data_hora_fim,
        status_agendamento="BLOQUEIO_MANUAL",
        metodo_pagamento="BLOQUEIO",
        valor_final_cobrado=Decimal("0.00"),
        cashback_utilizado=Decimal("0.00"),
    )
    db.add(bloqueio)
    try:
        db.commit()
        db.refresh(bloqueio)
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "criação de bloqueio")
    return bloqueio


@app.get(
    "/painel/servicos",
    response_model=list[schemas.ServicoDisponivel],
    tags=["painel"],
)
def listar_servicos_painel(
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    return [
        schemas.ServicoDisponivel.model_validate(row._asdict())
        for row in (
            db.query(
                models.ProfissionalServicoModel.id_profissional_servico,
                models.EstabelecimentoModel.id_estabelecimento,
                models.EstabelecimentoModel.nome_fantasia.label("nome_estabelecimento"),
                models.EstabelecimentoModel.endereco_completo,
                models.ProfissionalModel.id_profissional,
                models.ProfissionalModel.nome.label("profissional"),
                models.ServicoModel.id_servico,
                models.ServicoModel.nome_servico,
                models.ServicoModel.descricao,
                models.ServicoModel.duracao_estimada_minutos,
                models.ProfissionalServicoModel.preco,
            )
            .select_from(models.ProfissionalServicoModel)
            .join(
                models.ProfissionalModel,
                models.ProfissionalServicoModel.id_profissional
                == models.ProfissionalModel.id_profissional,
            )
            .join(
                models.ServicoModel,
                models.ProfissionalServicoModel.id_servico == models.ServicoModel.id_servico,
            )
            .join(
                models.EstabelecimentoModel,
                models.ProfissionalModel.id_estabelecimento
                == models.EstabelecimentoModel.id_estabelecimento,
            )
            .filter(models.ProfissionalModel.id_estabelecimento == estabelecimento_id)
            .filter(
                models.ProfissionalServicoModel.preco.is_not(None),
                models.ProfissionalServicoModel.preco > 0,
            )
            .order_by(models.ServicoModel.nome_servico)
            .all()
        )
    ]


@app.post(
    "/painel/servicos",
    response_model=schemas.ServicoDisponivel,
    status_code=status.HTTP_201_CREATED,
    tags=["painel"],
)
def cadastrar_servico(
    payload: schemas.ServicoCadastro,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    profissional = (
        db.query(models.ProfissionalModel)
        .filter_by(
            id_profissional=payload.id_profissional,
            id_estabelecimento=estabelecimento_id,
            status_ativo=True,
        )
        .first()
    )
    if profissional is None:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    servico = models.ServicoModel(
        **payload.model_dump(
            exclude={"id_profissional", "preco"}
        )
    )
    db.add(servico)
    try:
        db.flush()
        vinculo = models.ProfissionalServicoModel(
            id_profissional=profissional.id_profissional,
            id_servico=servico.id_servico,
            preco=payload.preco,
        )
        db.add(vinculo)
        db.commit()
        db.refresh(vinculo)
    except IntegrityError:
        responder_erro_integridade(db, "Não foi possível cadastrar o serviço.")
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "cadastro de serviço")
    return schemas.ServicoDisponivel(
        id_profissional_servico=vinculo.id_profissional_servico,
        id_estabelecimento=estabelecimento_id,
        nome_estabelecimento=db.get(models.EstabelecimentoModel, estabelecimento_id).nome_fantasia,
        endereco_completo=db.get(models.EstabelecimentoModel, estabelecimento_id).endereco_completo,
        id_profissional=profissional.id_profissional,
        profissional=profissional.nome,
        id_servico=servico.id_servico,
        nome_servico=servico.nome_servico,
        descricao=servico.descricao,
        duracao_estimada_minutos=servico.duracao_estimada_minutos,
        preco=vinculo.preco,
    )


@app.delete(
    "/painel/servicos/{id_profissional_servico}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["painel"],
)
def excluir_servico(
    id_profissional_servico: int,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    """Remove um serviço do estabelecimento autenticado (D do CRUD).

    Reservas futuras ainda ativas impedem a exclusão. O histórico de
    agendamentos é preservado: a FK em `agendamento` usa ON DELETE SET NULL.
    """
    vinculo = (
        db.query(models.ProfissionalServicoModel)
        .join(models.ProfissionalModel)
        .filter(
            models.ProfissionalServicoModel.id_profissional_servico == id_profissional_servico,
            models.ProfissionalModel.id_estabelecimento == estabelecimento_id,
        )
        .first()
    )
    if vinculo is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    reserva_futura = (
        db.query(models.AgendamentoModel.id_agendamento)
        .filter(
            models.AgendamentoModel.id_profissional_servico == id_profissional_servico,
            models.AgendamentoModel.status_agendamento == "AGENDADO",
            models.AgendamentoModel.data_hora_inicio > datetime.now(),
        )
        .first()
    )
    if reserva_futura:
        raise HTTPException(
            status_code=409,
            detail="Há reservas futuras para este serviço. Cancele-as antes de excluir.",
        )
    id_servico = vinculo.id_servico
    try:
        db.query(models.AgendamentoModel).filter_by(
            id_profissional_servico=id_profissional_servico
        ).update({"id_profissional_servico": None}, synchronize_session=False)
        db.delete(vinculo)
        db.flush()
        outros_vinculos = (
            db.query(models.ProfissionalServicoModel.id_profissional_servico)
            .filter_by(id_servico=id_servico)
            .first()
        )
        if outros_vinculos is None:
            servico = db.get(models.ServicoModel, id_servico)
            if servico is not None:
                db.delete(servico)
        db.commit()
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "exclusão de serviço")
    return None


@app.get(
    "/painel/agendamentos",
    response_model=list[schemas.AgendamentoPainel],
    tags=["painel"],
)
def listar_agendamentos_painel(
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
    data: date | None = None,
):
    query = (
        db.query(
            models.AgendamentoModel,
            models.CarteiraUsuarioModel.nome_completo.label("cliente"),
            models.ProfissionalModel.nome.label("profissional"),
            models.ServicoModel.nome_servico.label("nome_servico"),
        )
        .join(models.ProfissionalModel)
        .outerjoin(
            models.CarteiraUsuarioModel,
            models.AgendamentoModel.id_usuario == models.CarteiraUsuarioModel.id_usuario,
        )
        .outerjoin(
            models.ProfissionalServicoModel,
            models.AgendamentoModel.id_profissional_servico
            == models.ProfissionalServicoModel.id_profissional_servico,
        )
        .outerjoin(
            models.ServicoModel,
            models.ProfissionalServicoModel.id_servico == models.ServicoModel.id_servico,
        )
        .filter(models.ProfissionalModel.id_estabelecimento == estabelecimento_id)
    )
    if data is not None:
        inicio = datetime.combine(data, time.min)
        query = query.filter(
            models.AgendamentoModel.data_hora_inicio >= inicio,
            models.AgendamentoModel.data_hora_inicio < inicio + timedelta(days=1),
        )
    rows = query.order_by(models.AgendamentoModel.data_hora_inicio.desc()).limit(200).all()
    return [
        schemas.AgendamentoPainel(
            **schemas.AgendamentoResponse.model_validate(row[0]).model_dump(),
            cliente=row.cliente,
            profissional=row.profissional,
            nome_servico=row.nome_servico,
        )
        for row in rows
    ]


@app.patch(
    "/painel/agendamentos/{id_agendamento}",
    response_model=schemas.AgendamentoResponse,
    tags=["painel"],
)
def atualizar_status_agendamento(
    id_agendamento: int,
    payload: schemas.AgendamentoStatusUpdate,
    estabelecimento_id: Annotated[int, Depends(get_estabelecimento_id)],
    db: Annotated[Session, Depends(get_db)],
):
    agendamento = (
        db.query(models.AgendamentoModel)
        .join(models.ProfissionalModel)
        .filter(
            models.AgendamentoModel.id_agendamento == id_agendamento,
            models.ProfissionalModel.id_estabelecimento == estabelecimento_id,
        )
        .with_for_update()
        .first()
    )
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    if agendamento.status_agendamento != "AGENDADO":
        raise HTTPException(status_code=409, detail="O status deste agendamento já foi alterado.")
    if payload.status_agendamento == "CONCLUIDO" and agendamento.data_hora_fim > datetime.now():
        raise HTTPException(status_code=409, detail="O serviço ainda não terminou.")
    if payload.status_agendamento == "CANCELADO" and agendamento.id_usuario is not None:
        usuario = db.get(models.CarteiraUsuarioModel, agendamento.id_usuario)
        if usuario is not None:
            usuario.saldo_cashback += agendamento.cashback_utilizado
    agendamento.status_agendamento = payload.status_agendamento
    try:
        db.commit()
        db.refresh(agendamento)
    except SQLAlchemyError:
        encerrar_transacao_com_erro(db, "atualização de status do agendamento")
    return agendamento
