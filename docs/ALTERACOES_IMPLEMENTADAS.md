# Alterações implementadas no Kalix

**Estado documentado em 26/10/2026.**

Este documento reúne o que foi implementado no Kalix até o momento e descreve as partes que compõem o diretório do projeto: API, banco de dados, aplicação mobile-first, protótipo visual e documentação. O objetivo é registrar o estado real do código, incluindo os fluxos disponíveis e as limitações que ainda precisam ser consideradas.

A especificação-alvo completa, com histórias US01–US09, requisitos não
funcionais, regras, processos e plano incremental, está em
[`SRS_KALIX.md`](./SRS_KALIX.md). A SRS preserva a implementação atual em
React/FastAPI e distingue requisitos planejados de funcionalidades entregues.

> **Situação do escopo:** além das alterações de backend descritas aqui, agora existe uma interface React/Vite integrada para descoberta, reservas de cliente e painel básico de estabelecimento. O produto ainda tem limites e fluxos pendentes, relacionados na seção final.

## Visão geral do diretório

O repositório contém a aplicação executável React/Vite, a API FastAPI, os esquemas do banco e um protótipo HTML/CSS/JavaScript que preserva telas de referência. A aplicação React é o frontend integrado à API FastAPI; as páginas HTML em `kalix.PI/Fkalix.PI/` são referências e não fazem parte do fluxo de execução do frontend React.

| Caminho | Conteúdo e finalidade |
|---|---|
| `frontend/` | Aplicação React com Vite, telas responsivas, integração com a API e instruções próprias de execução. |
| `frontend/src/App.jsx` | Componentes e fluxos: descoberta e busca, autenticação, reserva, conta do cliente e painel do estabelecimento. |
| `frontend/src/styles.css` | Identidade visual, componentes e regras responsivas para desktop e telas móveis. |
| `frontend/src/api.js` | Cliente HTTP da API, tratamento de erros e formatação de valores e datas. |
| `frontend/src/main.jsx` | Ponto de entrada React, montagem do componente principal e importação dos estilos. |
| `frontend/index.html`, `frontend/vite.config.js`, `frontend/package.json` | Página de entrada, configuração do Vite e dependências/comandos do frontend. |
| `backend/` | API REST FastAPI, modelos SQLAlchemy, schemas de validação, conexão com banco, segurança, dependências e instruções. |
| `database/schema.sql` | Estrutura SQL para uma instalação nova do banco MySQL. |
| `database/migrations/001_mvp_alignment.sql` | Alinhamento de uma instalação MySQL legada ao modelo atual; aplicar uma única vez após backup. |
| `kalix.PI/Fkalix.PI/` | Protótipo/referência visual HTML, CSS e JavaScript, com telas de início, cadastro, login, estabelecimento, mapa, painel, clube, perfil, avaliação, pagamento e flash. |
| `kalix.PI/Fkalix.PI/backend/` | Servidor Node.js independente do protótipo, com persistência em arquivo JSON e testes próprios; não é a API usada pelo React. |
| `docs/` | Histórico do projeto e imagens dos modelos conceitual e lógico. |
| `README.md`, `backend/README.md`, `frontend/README.md` | Visão geral do repositório e instruções de execução da API e do frontend. |

O diretório também pode conter arquivos locais de configuração, ambientes virtuais, dependências instaladas e resultados de build. Esses artefatos não são funcionalidades do produto. Arquivos `.env` locais podem conter credenciais e não devem ser documentados com seus valores nem enviados ao controle de versão.

## Visão geral das alterações

Antes das alterações, o repositório continha principalmente arquivos iniciais de FastAPI, modelos SQLAlchemy e o script SQL do MySQL. Havia diferenças entre o banco e os modelos, autenticação incompleta, senha armazenada em formato de demonstração e uma rota de agendamento que aceitava campos de identidade e preço enviados pelo cliente.

O trabalho atual:

- centraliza os modelos, validações de entrada e regras da API;
- cria cadastro e login separados para clientes e estabelecimentos;
- protege rotas privadas com tokens Bearer e separação de perfis;
- fornece catálogo de serviços, reservas e operações básicas do painel;
- acrescenta uma migration para bancos já criados, sem depender de recriá-los;
- cria uma interface React/Vite responsiva e mobile-first para clientes e estabelecimentos;
- adapta a navegação do cliente a uma experiência de aplicativo móvel com barra inferior;
- documenta configuração, rotas, regras e limites conhecidos.

## Alterações por arquivo

### `backend/main.py`

A estrutura da aplicação FastAPI foi reorganizada para:

- criar tabelas ausentes no startup via `Base.metadata.create_all`;
- configurar CORS para origens configuráveis em `CORS_ORIGINS`;
- verificar a conectividade do banco em `GET /health`;
- centralizar a leitura e validação dos tokens de acesso e verificar o perfil do usuário;
- distinguir erros de integridade (`409`) de falhas internas de banco (`500`), registrando as falhas internas no log;
- oferecer rotas de descoberta, autenticação, consulta de conta, agendamento e painel do estabelecimento.

Os fluxos principais implementados são:

1. Cadastro e login de clientes.
2. Cadastro e login de estabelecimentos, com criação conjunta da credencial e do profissional responsável.
3. Busca pública de estabelecimentos e serviços ativos.
4. Consulta dos próprios agendamentos e cancelamento pelo cliente.
5. Painel de estabelecimento com resumo, cadastro e ativação de profissionais, cadastro de serviços, bloqueio de agenda e atualização de status de reservas.

### `backend/security.py`

Foi adicionado um módulo dedicado a credenciais:

- senhas são transformadas em hashes PBKDF2-HMAC-SHA256 com salt individual;
- a verificação utiliza comparação de tempo constante;
- tokens JWT contêm o perfil, o identificador da conta e expiram após 12 horas;
- a chave JWT vem de `SECRET_KEY`; se ausente, uma chave temporária é gerada e o processo emite um aviso.

A chave temporária permite desenvolvimento local, mas invalida os tokens quando a aplicação reinicia. Para ambientes compartilhados, configure um valor secreto persistente fora do código.

### `backend/schemas.py`

Os contratos Pydantic passaram a validar:

- formato e normalização de e-mail;
- tipos permitidos para público-alvo e método de pagamento;
- tamanho e formato de CNPJ/CPF, coordenadas geográficas quando informadas, preço, duração, cashback e campos de texto;
- datas futuras, ausência de fuso horário nos horários locais e intervalos de bloqueio válidos;
- campos específicos para cadastro, autenticação, painel e apresentação do catálogo.

As respostas têm modelos próprios para evitar devolver o hash de senha e para manter uma estrutura consistente na API.

### `backend/models.py`

Os modelos SQLAlchemy agora descrevem também tabelas que estavam apenas no SQL (`oferta_plano` e `avaliacao`), e incluem:

- `conta_estabelecimento`, que guarda as credenciais de acesso ao painel em uma tabela separada;
- preferência de público-alvo para clientes e estabelecimentos;
- relações ORM entre estabelecimento, conta, profissionais, serviços e seus vínculos;
- restrições de unicidade, intervalo, valores e quantidades;
- índices nas colunas usadas para consultar a agenda por profissional e por cliente.

O preço de `profissional_servico` pode permanecer nulo por compatibilidade com registros antigos. O catálogo público e os fluxos de agendamento, contudo, só expõem serviços com preço positivo.

### `backend/database.py`

O módulo de conexão passou a:

- carregar o arquivo `backend/.env` explicitamente;
- usar MySQL quando `DATABASE_URL` estiver configurada;
- permitir SQLite como fallback para desenvolvimento sem configuração;
- aplicar a opção SQLite necessária para uso do SQLAlchemy entre threads;
- continuar fornecendo sessões por dependência, com fechamento após cada requisição.

O fallback SQLite não converte nem substitui o banco MySQL existente.

### `database/schema.sql`

O script para novas instalações foi atualizado com:

- a tabela `conta_estabelecimento`;
- os campos de público-alvo;
- limites para duração, valores, cashback e status;
- valores monetários ampliados para comportar preços e totais do MVP;
- os estados de reserva `BLOQUEIO_MANUAL` e método de pagamento `BLOQUEIO`;
- índices para consultas de agenda.

### `database/migrations/001_mvp_alignment.sql`

Foi criada uma migration para bancos MySQL já existentes. Ela acrescenta os campos de público-alvo e a tabela de conta do estabelecimento, amplia colunas financeiras, converte enumerações de reserva para texto e acrescenta cashback e índices.

**A migration deve ser aplicada uma única vez, após backup, antes de iniciar a nova API contra um banco legado.** Ela não redefine nem migra os hashes de senha antigos.

### `backend/requirements.txt` e `.env.example`

As dependências foram revisadas e foi incluído `PyJWT`. O arquivo `backend/.env.example` apresenta os nomes das configurações necessárias, sem conter credenciais reais.

### `backend/README.md`

O README agora documenta requisitos, instalação, configuração, migrations, inicialização, endpoints principais, exemplos de requisição e limitações conhecidas.

### `frontend/`

Foi criada uma aplicação React/Vite conectada à API do Kalix. A interface inclui:

- página responsiva de descoberta, busca e filtro por categoria de estabelecimento;
- catálogo de serviços com profissional, preço e duração;
- telas de cadastro e login para clientes e estabelecimentos;
- reserva com data e horário, forma de pagamento e cashback, utilizando os dados e a identidade validados pela API;
- página de histórico de reservas do cliente e opção para cancelar reservas futuras;
- painel de estabelecimento com resumo, agenda, equipe, cadastro de profissionais, catálogo de serviços e bloqueios;
- persistência do token no navegador, tratamento de erros da API e documentação própria para configuração.

#### Experiência mobile

O frontend é uma aplicação web responsiva projetada para celulares, tablets e desktops. A atualização mais recente adicionou uma barra inferior fixa em telas de até 700 px, com três destinos:

- **Início:** retorna ao topo da área de descoberta;
- **Explorar:** abre a seção de catálogo e busca;
- **Reservas:** abre as reservas do cliente autenticado ou solicita entrada na conta para visitantes.

A barra considera a área segura inferior do dispositivo. Ela não aparece no painel de estabelecimento. Em telas de até 480 px, o catálogo passa a usar uma coluna e os controles de categoria redundantes da barra de busca são ocultados para liberar espaço. Em telas maiores, a navegação superior e a grade de catálogo continuam disponíveis.

Essa experiência é mobile-first, mas ainda é uma aplicação web: o diretório não contém pacote nativo Android/iOS, publicação em lojas, suporte offline/PWA ou notificações push. O endereço da API é configurável com `VITE_API_URL`; as origens de desenvolvimento precisam estar liberadas em `CORS_ORIGINS` no backend. Detalhes de execução estão no [README do frontend](../frontend/README.md).

## Regras implementadas para agendamento

- A identidade do cliente vem do token, não de um `id_usuario` enviado no corpo.
- O serviço precisa estar associado a um profissional ativo e ter preço definido.
- A duração cadastrada determina automaticamente o horário final.
- O valor cobrado parte do preço registrado no catálogo, não de um preço informado pelo cliente.
- São recusados horários no passado, conflitos e bloqueios sobrepostos.
- O uso de cashback é limitado a 30% do preço e ao saldo existente.
- Ao cancelar uma reserva futura, o cashback previamente usado é devolvido à carteira.
- Um estabelecimento só pode operar sobre seus próprios profissionais e reservas.
- Marcar uma reserva como concluída antes do horário final é recusado.
- Pagamento por assinatura é recusado explicitamente: o fluxo de contratação e consumo de planos ainda não foi implementado.

## Como iniciar

As instruções completas estão no [README da API](../backend/README.md). Em resumo:

1. Crie e ative um ambiente virtual Python.
2. Instale `backend/requirements.txt`.
3. Configure `backend/.env` com `DATABASE_URL`, `SECRET_KEY` e `CORS_ORIGINS`.
4. Em instalação nova, aplique `database/schema.sql`; em banco legado, faça backup e aplique uma vez `database/migrations/001_mvp_alignment.sql`.
5. Inicie o servidor dentro da pasta `backend`:

   ```powershell
   python -m uvicorn main:app --reload
   ```

6. Consulte <http://127.0.0.1:8000/docs> para a documentação interativa.

`create_all()` cria tabelas ausentes, mas **não altera** as tabelas já existentes. Portanto, iniciar a API sem executar a migration em uma base antiga pode deixar o modelo Python incompatível com as colunas reais.

## Limites e próximos passos

- Ainda não há testes ponta a ponta contra a API e o banco MySQL nem testes automatizados dedicados para o frontend.
- Para a atualização mais recente de navegação mobile, foi executado `npm run build` na pasta do frontend e `git diff --check`. A compilação confirma a geração do frontend; não substitui testes em dispositivos físicos nem testes ponta a ponta.
- A experiência móvel é web responsiva. Não há aplicativo nativo, instalação offline/PWA, notificações push ou publicação em lojas configurados neste diretório.
- O formulário de reserva solicita um horário, mas a API ainda não expõe uma pesquisa de disponibilidade em tempo real. Conflitos são rejeitados quando a reserva é enviada.
- Não existe ainda um fluxo de pagamento integrado; os métodos são registrados no agendamento, sem processar transações financeiras.
- Assinaturas, avaliações, liberação de cashback, recuperação de senha e gestão avançada de disponibilidade não têm fluxo completo exposto na API.
- Usuários já existentes com hashes do formato de demonstração antigo não conseguem autenticar com o novo verificador PBKDF2. É necessária redefinição de senha ou uma estratégia de migração de credenciais; não há rota de redefinição implementada.
- Os horários são tratados como horário local sem timezone. Produção deve padronizar o fuso da aplicação, banco e interface.
- A checagem de sobreposição reduz conflitos, mas não substitui testes de concorrência no MySQL sob carga.
- Esta documentação descreve o estado do código desta entrega; não afirma que testes integrados contra um servidor MySQL foram executados.
