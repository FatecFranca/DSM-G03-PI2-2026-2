# Kalix — API

API REST do Kalix, construída com FastAPI, SQLAlchemy e MySQL.

## Requisitos

- Python 3.10 ou superior.
- MySQL 8.0 ou superior para uso normal do projeto.
- Um banco `kalix_db` criado no servidor MySQL.

Para uma execução local rápida sem MySQL, configure `DATABASE_URL=sqlite:///./kalix.db` no `.env`. A API cria `backend/kalix.db` durante a inicialização. Essa opção é destinada ao desenvolvimento e não substitui o MySQL usado no projeto.

## Configuração

No PowerShell, dentro desta pasta (`backend`):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edite `backend/.env` com as credenciais do seu próprio banco e uma chave aleatória para `SECRET_KEY`. Gere uma chave com:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Não versione o `.env` nem reutilize a chave de exemplo:

```env
DATABASE_URL=mysql+pymysql://usuario:senha@localhost:3306/kalix_db
SECRET_KEY=gere-uma-chave-aleatoria-com-pelo-menos-32-bytes
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Sem uma `SECRET_KEY` própria, o sistema gera uma chave temporária e os tokens existentes deixam de funcionar quando a API reinicia.

## Banco existente e migrations

Para uma instalação nova, execute a partir da raiz do repositório `database/schema.sql` e depois `database/programacao_banco.sql` (views, triggers e procedure) no MySQL antes de iniciar a API. Não execute `schema.sql` sobre um banco existente: o script cria tabelas e não é uma migration.

Para um banco antigo, faça backup antes de migrar. Se ele ainda não tem as alterações do MVP, aplique **uma única vez** `database/migrations/001_mvp_alignment.sql`:

```powershell
cmd /c "mysql -u usuario -p < ..\database\migrations\001_mvp_alignment.sql"
```

A migration acrescenta os campos de público-alvo e a conta de acesso do estabelecimento, e adapta status, método de pagamento, cashback e índices de agenda.
Ela não é idempotente: não a execute novamente sobre um banco já migrado.

Para tornar as coordenadas do estabelecimento opcionais em um banco existente, aplique também **uma única vez** `database/migrations/002_optional_establishment_coordinates.sql` (depois da 001, se ela foi necessária):

```powershell
cmd /c "mysql -u usuario -p < ..\database\migrations\002_optional_establishment_coordinates.sql"
```

Essa migration permite valores `NULL` em latitude e longitude e preserva as coordenadas existentes.

Em um banco novo criado pelo `schema.sql` atual, não é necessário executar as migrations 001 ou 002. Se o banco já está atualizado, não as execute novamente. `Base.metadata.create_all()` cria tabelas ausentes no startup, mas não modifica tabelas ou colunas existentes; não use `create_all()` como substituto para migrations.

O usuário MySQL configurado em `DATABASE_URL` precisa ter permissão para acessar `kalix_db` e para criar/alterar objetos se você executar os scripts SQL.

## Iniciar a API

Ainda na pasta `backend`, com o ambiente virtual ativado:

```powershell
python -m uvicorn main:app --reload
```

- Documentação interativa: <http://127.0.0.1:8000/docs>
- Verificação da API e do banco: <http://127.0.0.1:8000/health>

## Endpoints principais

| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| `POST` | `/auth/clientes/register` | Público | Cria uma conta de cliente. |
| `POST` | `/auth/clientes/login` | Público | Autentica um cliente e devolve token Bearer. |
| `POST` | `/auth/estabelecimentos/register` | Público | Cadastra estabelecimento, credencial e profissional responsável. |
| `POST` | `/auth/estabelecimentos/login` | Público | Autentica o estabelecimento e devolve token Bearer. |
| `GET` | `/me` | Autenticado | Retorna o perfil associado ao token. |
| `GET` | `/estabelecimentos` | Público | Lista estabelecimentos ativos; aceita filtros `nome` e `publico_alvo`. |
| `GET` | `/estabelecimentos/{id_estabelecimento}` | Público | Consulta o perfil público de um estabelecimento ativo. |
| `GET` | `/catalogo` | Público | Pesquisa serviços publicados, profissionais e estabelecimentos. |
| `GET` | `/profissionais` | Público | Lista profissionais ativos, opcionalmente filtrados por estabelecimento. |
| `GET` | `/servicos` | Público | Lista serviços cadastrados. |
| `GET` | `/minha-conta/agendamentos` | Cliente | Lista os próprios agendamentos, com nome do serviço e profissional. |
| `POST` | `/agendamentos` | Cliente | Reserva um serviço disponível. |
| `PATCH` | `/minha-conta/agendamentos/{id_agendamento}/cancelar` | Cliente | Cancela uma reserva própria ainda não iniciada. |
| `GET` | `/painel/resumo` | Estabelecimento | Exibe indicadores do painel. |
| `PATCH` | `/painel/estabelecimento` | Estabelecimento | Atualiza os dados do estabelecimento autenticado. |
| `GET`, `POST` | `/painel/profissionais` | Estabelecimento | Lista e cadastra profissionais do estabelecimento autenticado. |
| `PATCH` | `/painel/profissionais/{id_profissional}` | Estabelecimento | Ativa ou desativa um profissional próprio. |
| `GET`, `POST` | `/painel/servicos` | Estabelecimento | Lista e cadastra serviços com preço e profissional responsável. |
| `POST` | `/painel/bloqueios` | Estabelecimento | Bloqueia um intervalo da agenda de um profissional próprio. |
| `DELETE` | `/painel/servicos/{id_profissional_servico}` | Estabelecimento | Exclui um serviço próprio sem reservas futuras (reservas passadas são preservadas). |
| `GET` | `/painel/agendamentos` | Estabelecimento | Lista as reservas do estabelecimento; aceita filtro `data`. |
| `PATCH` | `/painel/agendamentos/{id_agendamento}` | Estabelecimento | Marca a reserva como concluída, cancelada ou ausência. |

Rotas privadas recebem `Authorization: Bearer <access_token>`. O perfil do token limita cada rota ao seu tipo de conta e, no painel, ao próprio estabelecimento.

### Exemplo de cadastro e reserva de cliente

```json
POST /auth/clientes/register
{
  "nome_completo": "Ana Silva",
  "email": "ana@example.com",
  "senha": "uma-senha-forte",
  "preferencia_publico": "AMBOS"
}
```

Use o token retornado como `Bearer` e envie a reserva:

```json
POST /agendamentos
{
  "id_profissional_servico": 1,
  "data_hora_inicio": "2030-06-15T14:00:00",
  "metodo_pagamento": "PIX",
  "cashback_utilizado": "0.00"
}
```

O fim da reserva é calculado usando a duração do serviço; o preço é lido do catálogo. Não envie `id_usuario`, preço ou horário final no corpo da reserva: a API identifica o cliente pelo token.

## Regras e limites atuais

- Senhas novas são armazenadas como PBKDF2-HMAC-SHA256 com salt individual; nunca são devolvidas nas respostas da API.
- Os tokens JWT expiram após 12 horas. Configure uma `SECRET_KEY` persistente antes de iniciar a aplicação em ambientes compartilhados.
- A reserva rejeita horários passados, serviço sem preço publicado, indisponibilidade do profissional, conflitos de horário, cashback acima de 30% do preço e saldo insuficiente.
- Reservas e bloqueios consideram intervalos sobrepostos. Cancelar uma reserva devolve o cashback usado.
- O cadastro público de estabelecimento cria também a conta e o responsável. As operações de painel ficam limitadas ao estabelecimento do token.
- O pagamento por assinatura é explicitamente recusado até existir um fluxo funcional de contratação e consumo de planos.
- Horários são tratados como horário local sem fuso horário; configure a aplicação e o banco com o mesmo fuso.
- O endpoint de health retorna `503` quando não consegue consultar o banco.

## Escopo pendente

O frontend React/Vite do MVP está em [`frontend/README.md`](../frontend/README.md) e já se integra às rotas documentadas acima. Ainda não há pagamento integrado, fluxo de assinatura, disponibilidade pesquisável antes de solicitar um horário ou testes ponta a ponta com MySQL.

Confira o histórico detalhado da evolução em [`docs/ALTERACOES_IMPLEMENTADAS.md`](../docs/ALTERACOES_IMPLEMENTADAS.md).
