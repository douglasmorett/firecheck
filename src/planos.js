// Ofertas da Cakto do plano "Até 10 pessoas" (R$ 67/mês).
// PREENCHER com os links da Cakto. O nome do PRODUTO na Cakto precisa ter
// "10 pessoas" (ex.: "FireCheck Até 10 pessoas"): é por ele que o webhook
// reconhece o plano (api/index.js, detectedPlan = checklists10_*).
// Enquanto um link estiver vazio, aquele ciclo do plano não aparece para compra.
export const CAKTO_DEZ = {
  mensal: 'https://pay.cakto.com.br/vpvqqaa', // FireCheck Até 10 pessoas - Mensal (R$ 67)
  anual: 'https://pay.cakto.com.br/3aj7nh6', // FireCheck Até 10 pessoas - Anual (R$ 564/ano)
};

export const temPlanoDez = (ciclo) => Boolean(CAKTO_DEZ[ciclo]);
