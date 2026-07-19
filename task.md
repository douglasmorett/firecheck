# 🔥 FireCheck — Tarefas de Reestruturação

## Fase 1: Remoção do Módulo Financeiro
- [x] Remover tab `financeiro` e `finance` do AdminDashboard
- [x] Remover paywall do financeiro
- [x] Remover UI completa do módulo financeiro ativo
- [x] Remover estados, funções e imports relacionados
- [x] Remover endpoints `/api/finance*`, `/api/scan-receipt`, `/api/scan-purchase`, `/api/chat-finance` da API

## Fase 2: Melhorias nos Checklists
- [x] Seções/agrupamento de tarefas no ChecklistCreator
- [x] Renderizar seções no ChecklistExecution
- [x] Múltiplas fotos por tarefa (até 4) no ChecklistExecution
- [x] Campo "max fotos" no ChecklistCreator
- [x] Categorias/tags no ChecklistCreator (Loja, Restaurante, Consultório, Veículo, etc)
- [x] Filtro por categoria no AdminDashboard
- [x] Campo de vinculação a ativo (placa/sala/equipamento) no ChecklistCreator
- [x] Seleção de ativo na execução do checklist
- [x] Assinatura digital (canvas) no ChecklistExecution
- [x] Toggle "Exigir assinatura" no ChecklistCreator

## Fase 3: Exportação e Offline
- [x] Exportação PDF de checklist concluído
- [x] Botão "Exportar PDF" no AdminDashboard
- [x] Modo offline — salvar no localStorage (firecheck_offline_queue) quando sem internet
- [x] Sync automático ao reconectar + notificação push ao dono pós-auditoria IA
- [x] Indicador visual de modo offline no app

## Deploy
- [x] Commit e push final
- [x] Disparar build TestFlight
