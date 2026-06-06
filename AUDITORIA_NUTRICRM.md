# Auditoria NutriCRM

## Resumo executivo

O NutriCRM já cobre bem o fluxo comercial principal para nutrição animal: cadastro de clientes, oportunidades, orçamentos, vendas, planejamento, importações, métricas e gestão por perfis. A base, porém, mostra sinais claros de crescimento acelerado sem consolidação arquitetural, com riscos relevantes em tipagem, performance, integridade de dados importados, segurança multiempresa e confiabilidade operacional.

As melhorias mais valiosas no curto prazo são:

1. endurecer isolamento por `companyId` e autorização por recurso;
2. corrigir a regressão de testes e o conjunto atual de erros de TypeScript;
3. reduzir consultas massivas no frontend (`limit: 2000/5000`) e mover agregações para o backend;
4. reestruturar importações para deduplicação/idempotência;
5. modularizar `server/db.ts`, `server/routers.ts` e páginas muito grandes do frontend.

---

## 1. Visão geral da arquitetura

### Stack identificada

- Frontend: React 19 + Vite + Wouter + TanStack Query + tRPC + Radix + Recharts
- Backend: Express + tRPC + Drizzle ORM + PostgreSQL
- Infra/integrações: Stripe, Resend, Web Push, XLSX
- Testes: Vitest

### Pontos positivos

- Stack moderna e coerente para produto SaaS.
- Uso de `zod` nas entradas do tRPC reduz erros de payload.
- Há separação básica entre frontend, backend e schema.
- O produto já contempla necessidades reais do segmento: carteira, visitas, forecast, importação de vendas/pedidos e gestão por representantes.

### Fragilidades estruturais

- `server/routers.ts` concentra muitas responsabilidades e regras de negócio.
- `server/db.ts` virou um “god file” com acesso a dados, regras de importação, métricas e operações administrativas.
- Páginas como `Clients.tsx`, `Importacoes.tsx`, `AiForecast.tsx`, `Reports.tsx` e `ManagerDashboard.tsx` estão grandes demais e misturam UI, transformação de dados e regras de negócio.
- Há uso frequente de `any`, coerções e formatos de retorno inconsistentes entre rotas.

### Recomendação

Migrar gradualmente para módulos por domínio:

- `server/modules/clients/*`
- `server/modules/sales/*`
- `server/modules/imports/*`
- `server/modules/quotes/*`
- `client/src/features/<dominio>/*`

Isso reduz regressões e facilita testes por domínio.

---

## 2. Riscos críticos

### 2.1. Segurança multiempresa e autorização por recurso

Há filtros por `companyId` em várias listagens, mas várias rotas `getById`, `update` e `delete` delegam por `id` sem evidência consistente de validação de pertencimento da entidade à empresa do usuário.

#### Impacto

- risco de vazamento entre empresas;
- risco de edição/exclusão cruzada por enumeração de IDs;
- risco maior em ambiente SaaS multi-tenant.

#### Melhorias prioritárias

- toda operação por ID deve validar `companyId` no `where`;
- toda mutação deve validar ownership/role no backend, nunca só no frontend;
- criar helpers como `assertCompanyScopedEntity(entityCompanyId, ctx.user.companyId)`.

### 2.2. Integridade de dados nas importações

As rotinas de importação de vendas e pedidos explicitamente “sempre criam novo” para representantes, clientes e produtos, usando apenas cache em memória por execução.

#### Impacto

- duplicação explosiva de cadastros;
- relatórios distorcidos;
- ABC, forecast e dashboards perdem confiabilidade;
- reimportações não são idempotentes.

#### Melhorias prioritárias

- deduplicar por chave de negócio (`companyId + codigo externo`);
- criar colunas externas/indexadas para entidades importadas;
- bloquear reprocessamento de NF/pedido já importado;
- registrar lote de importação com hash, usuário, arquivo e timestamp.

### 2.3. Saúde técnica abaixo do aceitável

O projeto hoje não está “verde”:

- `npm test` falha em `server/auth.logout.test.ts`;
- `npm run check` falha com múltiplos erros de tipagem em frontend e backend.

#### Impacto

- baixa confiança para deploy;
- regressões passam despercebidas;
- custo de manutenção sobe rapidamente.

#### Melhorias prioritárias

- estabelecer meta de branch principal sempre com testes e typecheck verdes;
- corrigir primeiro os erros existentes antes de novas features;
- adicionar CI mínima com `npm test` + `npm run check`.

---

## 3. Backend: avaliação e melhorias

### 3.1. `server/routers.ts`

#### Achados

- arquivo muito extenso, com múltiplos domínios;
- validações de entrada boas, mas regras de autorização espalhadas;
- mistura de orquestração HTTP/tRPC com regra de negócio.

#### Melhorias

- quebrar por routers de domínio (`clientsRouter`, `salesRouter`, `importsRouter`, etc.);
- mover side effects para services;
- padronizar retornos paginados (`{ data, total, pageInfo }`) em todas as listas.

### 3.2. `server/db.ts`

#### Achados

- concentra CRUD, métricas, importação, administração e forecast;
- vários trechos com queries dinâmicas tipadas como `any`;
- sinais de incompatibilidade com Drizzle em alguns pontos do typecheck.

#### Melhorias

- separar repositórios por agregado;
- remover `any` progressivamente;
- criar funções puras para transformação de dados importados;
- adicionar testes unitários para importação e métricas.

### 3.3. `server/db-metricas.ts`

#### Achados

- o arquivo está quebrado no typecheck por imports/símbolos ausentes (`getDb`, `sql`, `sales`, `eq`, `and`);
- isso indica regressão estrutural recente.

#### Melhorias

- corrigir imediatamente o módulo;
- cobrir com testes de contrato para métricas por período e filtros;
- consolidar métricas em um único serviço analítico.

### 3.4. Pagamentos e trial

#### Achados

- há lógica específica para permitir checkout mesmo com trial expirado;
- commits recentes mostram ajustes emergenciais para bypass de trial.

#### Risco

Quando regras de exceção começam a se acumular, o fluxo de acesso tende a ficar frágil e difícil de auditar.

#### Melhorias

- centralizar política de acesso em um único módulo;
- modelar estados explícitos: `trial_active`, `trial_expired`, `paid_active`, `grace_period`, `blocked`;
- registrar auditoria de mudanças de acesso.

---

## 4. Frontend: avaliação e melhorias

### 4.1. Consultas excessivas e agregação no cliente

Há várias telas buscando grandes volumes:

- `clients.list({ limit: 2000 })`
- `sales.list({ limit: 5000 })`
- `quotes.list({ limit: 500 })`
- `opportunities.list({ limit: 200/500 })`

Depois disso, o frontend calcula totais, alertas e agrupamentos localmente.

#### Impacto

- lentidão em bases reais;
- alto tráfego;
- UX pior em conexões móveis;
- risco de inconsistência entre telas.

#### Melhorias prioritárias

- criar endpoints agregados por tela;
- usar paginação real e filtros server-side;
- usar virtualização em listas grandes;
- evitar carregar “todos os clientes” para selects, usando busca incremental.

### 4.2. Páginas grandes demais

#### Mais críticas

- `client/src/pages/Clients.tsx`
- `client/src/pages/Importacoes.tsx`
- `client/src/pages/AiForecast.tsx`
- `client/src/pages/Reports.tsx`
- `client/src/pages/ManagerDashboard.tsx`

#### Melhorias

Extrair:

- hooks de dados;
- componentes de formulário;
- utilitários de parsing/formatação;
- componentes de tabela/cartões/gráficos.

### 4.3. Tipagem inconsistente

Há muitos padrões como:

- `(data as any)`
- `Array.isArray(...) ? ... : ...`
- formatos de retorno diferentes para rotas semelhantes.

#### Melhorias

- padronizar contratos tRPC;
- inferir tipos diretamente do router;
- criar adapters de resposta no backend em vez de remendos no frontend.

### 4.4. UX específica para o segmento

O produto já conversa com o contexto agro, mas pode ficar muito mais aderente ao dia a dia de nutrição de ruminantes.

#### Melhorias de alto valor

- segmentação explícita por corte/leite, confinamento, semi-confinamento, recria, cria;
- cadastro de rebanho por categoria animal;
- consumo estimado por lote/fase;
- calendário de visitas técnicas com objetivos zootécnicos;
- histórico técnico-comercial por fazenda;
- alertas de recompra por ciclo de consumo;
- comparação entre orçamento, pedido em carteira e faturamento.

---

## 5. Dados, domínio e aderência ao negócio

### Oportunidade clara: modelo mais forte para ruminantes

Hoje o CRM atende o comercial, mas ainda pode capturar melhor o valor consultivo do segmento.

### Melhorias de domínio recomendadas

#### Cadastro de cliente/fazenda

- tipo de exploração: leite, corte, cria, recria, engorda, confinamento;
- tamanho do rebanho por categoria;
- sistema produtivo;
- consumo mensal estimado por linha/produto;
- nutricionista/veterinário responsável;
- concorrentes presentes na conta.

#### Pipeline comercial

Adicionar etapas e sinais mais aderentes:

- diagnóstico técnico;
- teste de produto;
- avaliação de desempenho;
- negociação comercial;
- implantação;
- recompra/expansão.

#### Indicadores estratégicos

- potencial mensal por cliente;
- share-of-wallet estimado;
- taxa de conversão por representante e por região;
- tempo médio entre visita → orçamento → pedido → faturamento;
- carteira pendente por previsão de faturamento;
- margem por linha/solução/representante.

---

## 6. Importações e governança de dados

### Situação atual

Importação é um diferencial forte do produto, mas hoje parece mais “ingestão rápida” do que pipeline confiável.

### Melhorias prioritárias

1. **Idempotência**
   - impedir duplicação por NF, pedido e códigos externos.

2. **Pré-validação forte**
   - validar colunas obrigatórias;
   - mostrar erros por linha antes do envio;
   - bloquear importação com inconsistências críticas.

3. **Rastreabilidade**
   - salvar lote, nome do arquivo, usuário, hash, contagem e erros.

4. **Reconciliação**
   - permitir vincular cliente/produto importado a cadastro existente.

5. **Observabilidade**
   - dashboard de importações com taxa de erro, duplicados e tempo de processamento.

---

## 7. Performance

### Gargalos prováveis

- consultas amplas para dashboards e relatórios;
- agregações feitas no navegador;
- listas grandes sem paginação/virtualização;
- importações linha a linha com múltiplos inserts sequenciais.

### Melhorias

- índices compostos por `companyId + status`, `companyId + createdAt`, `companyId + codigo externo`;
- batch insert/upsert nas importações;
- endpoints analíticos dedicados;
- cache curto para métricas;
- paginação cursor-based em listas críticas.

---

## 8. Qualidade, testes e DX

### Situação atual

Há testes úteis, mas cobertura ainda é pequena frente ao tamanho do sistema. O typecheck quebrado reduz muito a confiança.

### Melhorias prioritárias

#### Curto prazo

- corrigir teste de logout;
- zerar erros de TypeScript;
- adicionar CI obrigatória.

#### Médio prazo

- testes para importação de vendas/pedidos;
- testes de autorização multiempresa;
- testes de métricas e forecast;
- testes de regressão para contratos tRPC.

#### DX

- scripts separados: `test:unit`, `test:router`, `check`, `build`;
- lint/format em pre-commit;
- fixtures de dados do agro para desenvolvimento local.

---

## 9. Roadmap recomendado

### Fase 1 — estabilização técnica (1–2 semanas)

- corrigir `npm test` e `npm run check`;
- corrigir `server/db-metricas.ts`;
- revisar autorização por `companyId` em todas as rotas por ID;
- adicionar CI mínima;
- mapear e corrigir retornos inconsistentes do tRPC.

### Fase 2 — confiabilidade operacional (2–4 semanas)

- refatorar importações com deduplicação/idempotência;
- criar histórico de lotes importados;
- mover agregações pesadas para backend;
- reduzir queries massivas no frontend.

### Fase 3 — aderência ao negócio ruminantes (3–6 semanas)

- enriquecer cadastro técnico das fazendas;
- criar indicadores de potencial/consumo/recompra;
- melhorar pipeline técnico-comercial;
- consolidar visão carteira → faturamento → margem.

### Fase 4 — escala e produto (contínuo)

- modularização por domínio;
- observabilidade;
- auditoria de ações críticas;
- dashboards executivos mais rápidos e confiáveis.

---

## 10. Top 12 melhorias mais bem direcionadas

1. Validar `companyId` em toda leitura/mutação por ID.
2. Corrigir imediatamente o typecheck quebrado.
3. Corrigir o teste de logout e estabilizar CI.
4. Refatorar `server/db.ts` em módulos por domínio.
5. Refatorar `server/routers.ts` em routers menores.
6. Tornar importações idempotentes e deduplicadas.
7. Criar endpoints agregados para dashboard, gestor e relatórios.
8. Eliminar `limit: 2000/5000` e busca massiva no frontend.
9. Padronizar contratos tRPC para listas e detalhes.
10. Reduzir uso de `any` e coerções no frontend.
11. Enriquecer o modelo de dados para ruminantes/leite/corte.
12. Criar trilha de auditoria para acesso, importação e billing.

---

## Conclusão

O NutriCRM tem boa base funcional e já resolve dores reais do comercial agro. O maior ganho agora não está em adicionar mais telas, mas em consolidar confiabilidade: segurança multiempresa, qualidade técnica, performance e governança de dados importados. Depois dessa estabilização, o produto fica muito melhor posicionado para se diferenciar no nicho de nutrição de ruminantes com inteligência comercial e técnica de verdade.