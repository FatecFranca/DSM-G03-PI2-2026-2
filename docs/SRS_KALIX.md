# Especificação de Requisitos de Software — Kalix

**Versão:** 1.0
**Data:** 26/10/2026
**Status:** especificação-alvo para evolução incremental do MVP

## 1. Propósito e contexto

O Kalix é concebido como uma plataforma SaaS transacional B2B2C para o setor
de estética e beleza. A proposta é aproximar clientes de estabelecimentos,
permitindo que cada parceiro gerencie seus serviços, preços e agenda sem
tabelamento da plataforma.

O problema a resolver inclui a gestão fragmentada de agenda, cobrança e
relacionamento; horários ociosos, overbooking e faltas sem aviso; custos de
intermediação e dificuldade de fidelização. Para clientes, a jornada desejada
reúne descoberta por proximidade, agendamento, pagamento e recompensa.

O modelo de remuneração descrito para o produto é de 15% sobre serviços
avulsos e 5% sobre assinaturas, mediante split financeiro, sem mensalidade fixa
ao parceiro. O Flash Broadcast é a proposta de recuperação de horários vagos.
Esses itens são objetivos de produto, não funcionalidades financeiras já
disponíveis no código.

## 2. Escopo e decisão de arquitetura

Esta especificação preserva o repositório atual e orienta sua evolução em
etapas, sem migração arquitetural nesta fase:

- **Frontend atual:** React e Vite, web responsivo/mobile-first para clientes e
  painel do estabelecimento.
- **API atual:** Python com FastAPI e SQLAlchemy.
- **Persistência:** MySQL suportado para uso normal; SQLite disponível para
  desenvolvimento local.
- **Protótipo:** páginas HTML/CSS/JavaScript em `kalix.PI/Fkalix.PI/`, mantidas
  como referência visual. O servidor Node.js dessa pasta é independente e não
  é a API consumida pelo frontend React.

O documento de origem propõe Django REST, aplicativo mobile e painel web. A
implementação existente diverge em Django REST e aplicativo nativo: o escopo
aprovado para esta etapa mantém FastAPI e frontend web responsivo. Se a
instituição exigir Django REST ou pacote Android/iOS nativo, essa divergência
precisa ser tratada como decisão de projeto antes de uma migração.

### 2.1 Fora do escopo implementado atualmente

Gateway de pagamentos, split financeiro real, cobrança recorrente, publicação
de aplicativo em lojas, notificações push, operação offline e mapas com
geolocalização interativa não devem ser considerados entregues. A
especificação abaixo os mantém como requisitos-alvo.

## 3. Método de levantamento

O material fornecido para o projeto declara análise documental do plano de
negócios, entrevistas semiestruturadas com gestores, pesquisa quantitativa
com consumidores de 18 a 45 anos, mapeamento de jornada e prototipagem com
validação iterativa. Ele também descreve priorização MoSCoW, BPMN, casos de
uso, modelo relacional MySQL e protótipo Figma.

Este repositório contém diagramas conceitual e lógico em `docs/` e telas de
referência HTML. Não foram localizados neste inventário os instrumentos,
transcrições, resultados quantitativos, arquivos BPMN ou arquivo Figma; assim,
as atividades de pesquisa são registradas como metodologia declarada, não
como resultados auditados neste documento.

## 4. Atores

| Ator | Responsabilidade |
|---|---|
| Visitante | Descobrir serviços e criar uma conta de cliente ou estabelecimento. |
| Cliente B2C | Buscar, agendar, pagar, acompanhar reservas e avaliar atendimentos. |
| Gestor/profissional B2B | Gerenciar vitrine, equipe, agenda e reservas do próprio espaço. |
| Sistema Kalix | Validar regras, manter catálogo e reservas e coordenar integrações. |
| Gateway de pagamento | Autorizar cobranças e executar split, quando integrado. |
| Serviço de notificações | Entregar avisos de agenda e oportunidades Flash, quando integrado. |

## 5. Requisitos funcionais — histórias de usuário

Prioridades MoSCoW reproduzem a priorização fornecida. **MUST** é essencial
para o produto descrito; **SHOULD** é importante, mas pode vir depois da
primeira entrega.

| ID | Prioridade | História e critérios de aceite | Situação no código atual |
|---|---|---|---|
| US01 | MUST | Como cliente casual, quero localizar estabelecimentos próximos no mapa usando GPS, ver distância, foto e nota nos pinos e abrir a vitrine do estabelecimento ao selecionar um pino. | **Parcial:** o cadastro armazena coordenadas e há catálogo. Mapa interativo, geolocalização do cliente, distância, fotos e notas agregadas não estão integrados ao frontend/API. |
| US02 | MUST | Como cliente, quero agendar e pagar via Pix ou cartão, receber confirmação do gateway, split de 15% para Kalix e 85% para o parceiro e cashback inicialmente congelado. | **Parcial:** reserva registra método de pagamento e permite uso de cashback. Não há gateway, confirmação de transação, split nem ciclo de cashback congelado. |
| US03 | MUST | Como cliente fiel, quero assinar o clube do profissional, com cobrança recorrente mensal no cartão, renovação da cota e taxa de software Kalix de 5%. | **Não implementado como fluxo:** existem estruturas de dados relacionadas a planos/assinaturas, mas não há contratação, cobrança recorrente ou consumo de cotas funcionando. |
| US04 | MUST | Como profissional, quero visualizar a grade atualizada e bloquear horários manualmente sem cliente fictício. A agenda deve sincronizar por short polling de 10 segundos; bloqueios devem aceitar `cliente_id` nulo. | **Parcial:** o painel permite criar bloqueios manuais e a API verifica conflitos. Atualização periódica de 10 segundos e validação completa do bloqueio com cliente nulo precisam ser concluídas/verificadas. |
| US05 | SHOULD | Como profissional, quero que cancelamentos com menos de 3 horas para o início notifiquem simultaneamente a lista de espera; a primeira aceitação deve reservar a vaga atomicamente. | **Não implementado:** não há lista de espera, push, regra de 3 horas nem reserva atômica da vaga. |
| US06 | MUST | Como cliente, quero avaliar o atendimento por selos; o cashback fica congelado até a avaliação, pode abater no máximo 30% de uma próxima compra e críticas privadas ficam visíveis ao gestor. | **Parcial:** o backend limita o abatimento a 30% e possui modelo de avaliação/campo de liberação. Envio de avaliação, críticas privadas e liberação de cashback condicionada não estão conectados em fluxo funcional. |
| US07 | MUST | Como visitante, quero criar conta de cliente ou empresa, manter meu perfil e sair com segurança. O cadastro alvo inclui nome, e-mail, celular, CEP, gênero e interesses; autenticação por e-mail/senha ou Google/Apple. | **Parcial:** cadastro/login por e-mail e senha para cliente e estabelecimento, sessão e logout. Campos completos de perfil, edição de perfil e autenticação social não estão disponíveis. |
| US08 | MUST | Como gestor, quero cadastrar, editar e inativar serviços com preço livre e duração, exibidos na vitrine com profissional responsável. | **Parcial:** há cadastro/listagem de serviços com preço, duração e profissional. Exclusão disponível no painel e na API (`DELETE /painel/servicos/{id}`); edição ainda não está exposta como fluxo completo. |
| US09 | MUST | Como cliente, quero montar carrinho com um ou mais serviços, escolher profissional específico ou “Qualquer um”, ver apenas horários disponíveis e revisar o total antes de pagar. | **Parcial:** é possível reservar um serviço informando horário e profissional do catálogo. Carrinho múltiplo, escolha “Qualquer um”, pesquisa de disponibilidade e revisão do total agregado não estão implementados. |

## 6. Requisitos funcionais complementares

Estes requisitos consolidam comportamentos necessários para tornar as histórias
testáveis:

- **RF10 — Autorização:** restringir cada operação privada ao perfil autenticado
  e aos recursos pertencentes ao estabelecimento do token.
- **RF11 — Integridade da agenda:** rejeitar horários passados, sobreposição com
  reservas/bloqueios e dupla confirmação concorrente.
- **RF12 — Preço autônomo:** exibir e cobrar o preço configurado pelo
  estabelecimento; a plataforma não altera nem tabela preços.
- **RF13 — Cancelamento:** aplicar política de cancelamento configurada,
  atualizar o status e devolver valores/créditos conforme regras financeiras.
- **RF14 — Auditoria financeira:** registrar valor bruto, desconto, cashback,
  tarifa da plataforma, valor do parceiro, método, identificador do gateway e
  estado da transação, com trilha auditável.
- **RF15 — Flash Broadcast:** publicar uma vaga elegível para clientes da lista
  de espera e garantir que apenas uma aceitação confirme a vaga.
- **RF16 — Reputação:** agregar avaliações publicadas por clientes com reserva
  concluída e separar comentários privados dos dados públicos da vitrine.

RF13–RF16 precisam de regras de produto e APIs definidas antes da implementação
final. Os percentuais definidos nesta especificação não substituem contrato
comercial nem configuração segura do gateway.

## 7. Requisitos não funcionais

Os números abaixo são **metas iniciais sugeridas para validação**, não
resultados medidos nem garantias já atendidas:

| ID | Requisito |
|---|---|
| RNF01 — Segurança | Usar HTTPS em produção, hashes de senha com salt, segredos fora do código, autorização por perfil/posse, validação de entrada e proteção contra exposição de dados de pagamento. |
| RNF02 — Privacidade | Coletar localização somente após consentimento; permitir descoberta manual por cidade/endereço; documentar finalidade, retenção e exclusão de dados pessoais conforme LGPD. |
| RNF03 — Integridade transacional | Confirmar reserva e split somente após estado válido do pagamento; usar idempotência e operações atômicas contra duplo clique, repetição de webhook e concorrência na agenda. |
| RNF04 — Desempenho | Meta proposta: respostas de catálogo e agenda abaixo de 2 s no percentil 95 sob carga acordada para o MVP. Definir volume de teste antes de certificar. |
| RNF05 — Disponibilidade | Meta e janela de manutenção devem ser acordadas com o responsável pela operação; monitorar API, banco, gateway e entrega de notificações. |
| RNF06 — Compatibilidade móvel | Interface utilizável a partir de 320 px de largura, controles acessíveis ao toque e suporte aos navegadores móveis acordados para a entrega. |
| RNF07 — Acessibilidade | Buscar conformidade WCAG 2.1 AA nos fluxos essenciais, incluindo teclado, foco, contraste, rótulos e mensagens de erro. |
| RNF08 — Observabilidade | Registrar falhas com identificador de correlação, sem senhas, tokens ou dados de cartão; permitir diagnóstico de pagamentos e reservas. |
| RNF09 — Manutenibilidade | Manter contratos da API documentados, migrations versionadas e testes automatizados para regras de reserva, segurança e cálculo financeiro. |
| RNF10 — Recuperação | Definir backup, restauração e retenção para MySQL, incluindo verificação periódica de restauração antes de produção. |

## 8. Regras de negócio

- **RN01 — Precificação:** o estabelecimento define livremente o preço do
  serviço, sem tabelamento pela plataforma.
- **RN02 — Receita avulsa:** no modelo proposto, o split é 15% Kalix e 85%
  estabelecimento.
- **RN03 — Receita de clube:** no modelo proposto, 5% da assinatura é retido
  como taxa de software Kalix; a regra de repasse e tributos precisa ser
  confirmada comercialmente.
- **RN04 — Cashback:** o abatimento em uma reserva não pode ultrapassar 30% do
  preço elegível. No fluxo-alvo, cashback gerado só é liberado após avaliação
  válida. A regra atual do backend ainda não implementa esse ciclo completo.
- **RN05 — Agenda:** reservas e bloqueios não podem se sobrepor para o mesmo
  profissional; a validação deve permanecer correta sob requisições
  concorrentes.
- **RN06 — Bloqueio manual:** bloqueios não representam cliente e devem
  permitir referência de cliente nula.
- **RN07 — Flash:** cancelamento a menos de 3 horas do atendimento pode
  disparar oferta para lista de espera; apenas a primeira aceitação válida
  obtém a vaga.
- **RN08 — Pagamento:** marcar método de pagamento em uma reserva não equivale
  a processar ou confirmar pagamento. A reserva paga depende de confirmação
  verificável do gateway.
- **RN09 — Avaliação:** somente o cliente associado a um atendimento concluído
  pode avaliá-lo; comentário privado não aparece na vitrine pública.

## 9. Processos (BPMN em forma textual)

### BPMN 01 — Agendamento avulso

1. Cliente permite localização ou informa local de busca.
2. Kalix apresenta parceiros próximos e seus serviços, preços, profissionais
   e reputação.
3. Cliente escolhe um ou mais serviços e preferência de profissional.
4. Kalix consulta agenda, desconta reservas e bloqueios e apresenta horários
   elegíveis.
5. Cliente escolhe o horário e confere duração, preço e cashback disponível.
6. Kalix mantém a vaga sob controle transacional durante o checkout.
7. Cliente escolhe Pix ou cartão e confirma o pagamento.
8. Kalix envia cobrança e instruções de split ao gateway.
9. Em aprovação, Kalix confirma a reserva, registra o split e mantém cashback
   gerado bloqueado até a avaliação. Em recusa/expiração, libera a vaga e
   comunica o resultado ao cliente.
10. Estabelecimento recebe a reserva na agenda.
11. Após o atendimento, cliente envia avaliação; Kalix registra reputação e
    libera cashback elegível.

### BPMN 02 — Flash Broadcast

1. Reserva é cancelada dentro da janela de até 3 horas antes do início.
2. Kalix verifica elegibilidade, profissional, horário e clientes em espera.
3. Kalix publica a oportunidade e envia notificação simultânea.
4. Primeiro cliente elegível a aceitar vence a operação atômica da vaga.
5. Kalix confirma a reserva e encerra a oferta para os demais; se ninguém
   aceitar até o prazo, a oportunidade expira.

Esses fluxos representam o comportamento desejado. Gateway, retenção
temporária de vaga, lista de espera e notificações ainda precisam ser
implementados.

## 10. Casos de uso principais

| Caso de uso | Ator principal | Resultado esperado |
|---|---|---|
| UC01 — Descobrir parceiros | Visitante/Cliente | Lista ou mapa de estabelecimentos próximos com vitrine. |
| UC02 — Criar conta e autenticar | Visitante | Sessão válida de cliente ou estabelecimento. |
| UC03 — Gerenciar vitrine | Gestor B2B | Serviços e preços publicados e atualizados. |
| UC04 — Reservar e pagar | Cliente | Reserva confirmada após pagamento e sem conflito de agenda. |
| UC05 — Gerenciar agenda | Profissional/Gestor | Visualizar reservas e criar bloqueios sem cliente. |
| UC06 — Avaliar atendimento | Cliente | Avaliação vinculada ao atendimento; cashback elegível liberado. |
| UC07 — Assinar clube | Cliente | Assinatura recorrente, cota mensal e taxa registradas. |
| UC08 — Recuperar horário ocioso | Sistema/Cliente | Vaga cancelada ofertada; apenas uma aceitação confirmada. |
| UC09 — Administrar espaço | Gestor B2B | Gerenciar equipe, serviços, agenda e estados de reserva. |

## 11. Dados e modelo lógico

O domínio atual em `backend/models.py` já contempla entidades para usuários,
estabelecimentos, conta de estabelecimento, profissionais, serviços,
associação profissional-serviço, carteira de cashback, planos/ofertas,
assinaturas, agendamentos e avaliações. Os modelos e o script MySQL são a
referência do estado implementado; conferir os diagramas em `docs/` antes de
alterar o banco.

Para atender integralmente esta SRS, o modelo precisará representar também,
conforme decisão de produto: itens de carrinho/serviço por reserva,
disponibilidade e retenção temporária de vaga, estado e idempotência de
pagamento, eventos de split, ciclo de vida de cashback, lista de espera,
notificações e histórico de aceite Flash. As relações e constraints dessas
entidades devem ser definidas em modelo lógico e migrations antes de liberar
transações reais. Não armazenar dados completos de cartão.

## 12. Rastreabilidade e plano incremental

| Etapa | Escopo | Critério de saída |
|---|---|---|
| 0 — Base e segurança | Revisar regras, migrations, autorização, cobertura de testes e contrato da API; manter a stack atual. | Regras críticas de agenda e autenticação cobertas por testes; documentação da arquitetura consistente. |
| 1 — Descoberta móvel | US01: geolocalização opcional, mapa/lista, distância e vitrine; consentimento e busca manual alternativa. | Busca funciona sem permissão de GPS; pinos/itens abrem a vitrine e exibem apenas dados disponíveis. |
| 2 — Agenda e carrinho | US04 e US09: grade, polling de 10 s, bloqueio sem cliente, múltiplos serviços e disponibilidade concorrente. | Somente horários livres aparecem; duas tentativas simultâneas não confirmam a mesma vaga. |
| 3 — Pagamento avulso | US02: gateway, Pix/cartão, webhooks idempotentes, split 15/85 e estado de cashback pendente. | Aprovação, recusa, timeout e repetição de webhook cobertos por testes sem cobranças duplicadas. |
| 4 — Avaliação e cashback | US06: avaliação por atendimento, feedback privado e liberação após avaliação; manter teto de 30%. | Cliente não avalia atendimento alheio/não concluído; cashback só é utilizável após liberação. |
| 5 — Clube | US03: planos, recorrência, cota mensal, cancelamento e retenção de 5%. | Ciclo de cobrança/renovação/falha/cancelamento demonstrado em ambiente de testes do gateway. |
| 6 — Recuperação e perfil | US05, US07 e US08: lista de espera/Flash, perfis completos, gestão de serviços e notificações. | Concorrência Flash atômica; CRUD autorizado; preferências de privacidade e opt-out respeitados. |

As etapas indicam uma ordem recomendada, não uma promessa de prazo. O MySQL
permanece o alvo operacional da SRS; SQLite continua útil para desenvolvimento,
mas não substitui testes de concorrência e financeiros no MySQL.

## 13. Critérios gerais de validação

- Cada requisito funcional deve ter teste de aceite ligado ao seu ID US/RF.
- Não considerar pagamento concluído por simples registro do método escolhido.
- Testar conflitos e dupla confirmação com requisições concorrentes no MySQL.
- Testar a experiência responsiva em viewport móvel e a navegação por teclado.
- Testar permissões de localização negadas e busca manual alternativa.
- Testar sucesso, recusa, timeout e repetição de callbacks do gateway em
  ambiente de homologação, antes de produção.
- Registrar resultados de pesquisa e validação de protótipos somente quando
  houver artefatos verificáveis; este documento não inventa resultados.
