# Registro de mudanças técnicas

## Etapa 1 — Infraestrutura de testes
- Vitest (`npm test`). Testes do motor em `src/engine/__tests__`, do store em `src/store/__tests__`.
- Cobertura: balanço hídrico do solo (resíduo < 1e-6 mm por passo e no total), conservação no sistema hidráulico
  (retirado = aplicado + vazamento), ET₀ contra o Exemplo 19 da FAO-56, energia, determinismo, invariantes físicos
  (3 solos × 5 climas × 6 modos × 10 dias), cinco cenários, oito falhas e regressões.

## Etapa 2 — Correções de interface e alertas
- **A1 — Falso alerta de vazamento.** Sensores eram amostrados antes da hidráulica do passo, então o sensor de pressão lia ~0 na
  partida da bomba. Agora a amostragem ocorre ao final do passo (o controlador usa a amostra do passo anterior) e o alerta exige
  pressão medida baixa por ≥ 10 min. Arquivos: `engine/sim.ts`, `engine/alerts.ts`, `engine/types.ts`.
- **M2 — Plantas e área.** A geometria agora fecha com a configuração: W × L = área; o número de plantas desenhado = simulado =
  configurado (a configuração é normalizada para o valor realmente desenhado); a área de cada setor é a área cultivada real
  (plantas × entrelinha × espaçamento), usada no cálculo da lâmina (mm). O volume nominal do operador convencional (15 mm) passa a
  incidir sobre a área cultivada. Arquivos: `engine/layout.ts`, `engine/sim.ts`, `engine/controller.ts`, `ui/panels/ConfigPanel.tsx`.
- **M1 — Duração e invalidação dos cenários.** A duração escolhida passa para o store (sobrevive à troca de aba) e cada resultado
  registra a configuração que o gerou. Mudanças de configuração (exceto o modo, que cada cenário define) descartam resultados antigos e
  cálculos em andamento. Arquivos: `store/results.ts`, `store/sim.ts`, `engine/scenarios.ts`, `ui/panels/Scenarios.tsx`, `ui/panels/Demo.tsx`.

## Limitações conhecidas (não corrigidas nesta etapa)
- Modelo hidráulico é heurístico (sem vazão/emissor, sem curva da bomba medida): **aguarda dados reais** — ver proposta técnica.
- Parâmetros agronômicos (solo, Kc, profundidade radicular, p, aceleração do desenvolvimento) são **hipóteses demonstrativas**.
- Previsão de chuva usa o clima futuro exato (sem erro de previsão); comparação de cenários ainda sem déficit hídrico/perdas por origem.
- Obstrução de emissores em um único setor com todos abertos eleva a pressão ~12%, abaixo do limiar de alerta.
- Local do vazamento é apenas rótulo; automático/inteligente não têm limite de tempo de funcionamento.
- Reservatório: limites (0 e capacidade) descartam/criam água fora do caso normal; evaporação não consta nas estatísticas.
- Solar sem armazenamento; reposição de água ("poço") sem consumo de energia.
