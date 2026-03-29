# CRM Nutrição Animal - TODO

## Banco de Dados
- [x] Schema de clientes/fazendas
- [x] Schema de produtos
- [x] Schema de oportunidades (funil)
- [x] Schema de orçamentos
- [x] Schema de interações
- [x] Schema de usuários com roles
- [x] Migrations SQL

## Backend (tRPC Routers)
- [x] Router de clientes (CRUD, busca, filtros)
- [x] Router de produtos (CRUD, categorias)
- [x] Router de oportunidades (CRUD, atualizar etapa)
- [x] Router de orçamentos (CRUD, cálculos)
- [x] Router de interações (CRUD, histórico)
- [x] Router de dashboard (métricas, KPIs)
- [x] Router de relatórios (vendas, produtos, períodos)
- [ ] Testes unitários para routers

## Frontend - Layout e Navegação
- [x] DashboardLayout com sidebar
- [x] Navegação principal (Clientes, Oportunidades, Produtos, Orçamentos, Relatórios)
- [x] Tema visual profissional para CRM
- [x] Responsividade mobile

## Funcionalidades Frontend
- [x] Página de Clientes (listagem, cadastro, edição, busca)
- [x] Página de Oportunidades (Kanban visual com etapas)
- [x] Página de Produtos (listagem, cadastro, categorias)
- [x] Página de Orçamentos (listagem, criação, visualização)
- [x] Página de Dashboard (métricas, gráficos, KPIs)
- [x] Página de Relatórios (filtros por período, produto, vendedor)
- [ ] Histórico de Interações (timeline, notas, atividades)
- [ ] Busca e filtros avançados

## Autenticação e Controle de Acesso
- [ ] Sistema de login com Manus OAuth
- [ ] Roles (admin/vendedor)
- [ ] Permissões baseadas em roles
- [ ] Proteção de rotas

## Testes e Otimizações
- [ ] Testes de funcionalidades críticas
- [ ] Validações de dados
- [ ] Performance e carregamento
- [ ] Tratamento de erros

## Deploy e Entrega
- [ ] Checkpoint final
- [ ] Link de acesso para usuário

## Controle de Acesso por Usuário (Nova Fase)
- [ ] Criar página de gerenciamento de usuários (admin only)
- [ ] Implementar criar/editar/deletar usuários
- [ ] Implementar filtros de dados por usuário (clientes, oportunidades, orçamentos)
- [ ] Criar dashboard personalizado por vendedor
- [ ] Implementar relatórios individuais por vendedor
- [ ] Adicionar proteção de rotas por role (admin/vendedor)
- [ ] Testar com 20 usuários simultâneos
