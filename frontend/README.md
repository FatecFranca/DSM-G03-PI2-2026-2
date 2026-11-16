# Kalix — Frontend

Interface responsiva em React e Vite, integrada à API FastAPI. O catálogo público funciona sem login; para agendar e acessar o painel é preciso entrar com uma conta correspondente.

## Requisitos

- Node.js 20 ou superior.
- API Kalix em execução; confira as instruções em [`../backend/README.md`](../backend/README.md).

## Instalação e execução

No PowerShell, dentro desta pasta:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Mantenha esse terminal aberto enquanto estiver usando o site e inicie a API em outro terminal conforme [`../backend/README.md`](../backend/README.md). O `.env.local` é uma configuração local; não coloque segredos nele nem o envie ao GitHub.

O site estará em <http://localhost:5173>. Ajuste `VITE_API_URL` em `.env.local` para o endereço da API:

```env
VITE_API_URL=http://localhost:8000
```

Ajuste `CORS_ORIGINS` no `backend/.env` para aceitar a origem do site. Exemplo de desenvolvimento:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Funcionalidades

- Pesquisa dos serviços publicados e filtros por nome, profissional, endereço e categoria.
- Cadastro/login de clientes e painel de cadastro/login de estabelecimentos.
- Reserva de serviços com seleção de data/hora, forma de pagamento e cashback disponível.
- Histórico de reservas do cliente e cancelamento de reservas futuras.
- Painel do estabelecimento com resumo, agenda, equipe e serviços.
- Cadastro, ativação e desativação de profissionais.
- Cadastro de serviço com duração, preço e profissional; bloqueio de intervalos na agenda; alteração do status das reservas.
- Layout web responsivo para celular, tablet e desktop, com navegação inferior móvel para Início, Explorar e Reservas.

A versão atual é um frontend web mobile-first; não é um aplicativo nativo Android/iOS e não inclui instalação offline/PWA ou notificações push. Os requisitos-alvo e a situação de cada história estão em [`../docs/SRS_KALIX.md`](../docs/SRS_KALIX.md).

## Integração

As chamadas HTTP e o tratamento de erros ficam em `src/api.js`. As telas utilizam os endpoints documentados no backend; os tokens Bearer ficam no `localStorage` do navegador. O frontend não armazena senhas e não substitui as validações de autorização ou de dados executadas pela API.

## Regras e limitações

- As reservas usam os horários locais do navegador; sincronize o fuso do navegador, aplicação e banco.
- A API atual não fornece pesquisa de disponibilidade em tempo real. O formulário pede um horário e a API rejeita conflitos de agenda na confirmação.
- Pagamentos são registrados, não processados. Pagamento por assinatura não está disponível.
- As categorias disponibilizadas pelo cliente para busca são Barbearia, Salão, Unhas e Estética.
- O catálogo é carregado ao abrir a área de descoberta e atualizado quando a aba do site volta a ficar visível.

## Verificação

```powershell
npm run build
```
