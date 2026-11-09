# SmartFarm Simulator 1.0

> **Plantio inteligente. Água consciente. Agricultura conectada.**

Simulador web interativo de **agricultura inteligente (Smart Agriculture)** aplicado ao cultivo de **maracujá**. Ele reproduz uma propriedade rural equipada com sensores IoT, irrigação automatizada, monitoramento ambiental, controle remoto e análise de dados, tudo com cálculos reais de balanço hídrico e evapotranspiração rodando em tempo simulado.

## Para que serve

O projeto é uma **demonstração tecnológica e educativa**. Serve para mostrar, de forma visual e interativa, como a integração entre sensores, automação, conectividade e análise de dados pode tornar a irrigação mais eficiente.

Com ele é possível:

- apresentar o conceito de plantação inteligente a instituições, agricultores e estudantes;
- comparar, nas **mesmas condições climáticas**, cinco formas de irrigar (da convencional à otimizada) e ver quanta água, energia e tempo de bomba cada uma consome;
- provocar falhas (vazamento, sensor com defeito, queda de energia) e observar como o sistema detecta, alerta e reage;
- explorar como clima, tipo de solo e manejo afetam a umidade do solo e o desenvolvimento das plantas.

> **Aviso importante:** os parâmetros agronômicos (coeficientes de cultura, parâmetros de solo, profundidade radicular etc.) são **hipóteses demonstrativas**, ajustáveis na interface. O simulador **não prevê produtividade real** nem substitui recomendação agronômica. Todos os comandos são simulados: nenhum equipamento real é controlado.

## Como funciona

### Propriedade e visualização 3D
Uma propriedade dividida em **4 setores de irrigação (A–D)** com fileiras de maracujá em espaldeira, solo, tubulações, gotejadores, válvulas, reservatório, bomba hidráulica e estação meteorológica. A câmera pode ser rotacionada, aproximada ou alternada para vista superior. É possível clicar em plantas, sensores e setores para ver seus dados. Quando a irrigação liga, a bomba muda de estado, a água percorre as tubulações, os gotejadores pingam, a umidade do solo sobe e o reservatório perde volume.

### Sensores IoT virtuais
13 sensores distribuídos pela área: umidade e temperatura do solo, temperatura e umidade do ar, luminosidade, chuva, nível do reservatório, fluxo e pressão. Cada um tem identificação, posição, histórico, status, bateria e qualidade de sinal. Os valores derivam do estado físico simulado (hora, sol, chuva, irrigação, solo) acrescidos de ruído configurável, sem números aleatórios independentes.

### Motor de simulação (`src/engine`)
Módulo independente da interface, com:

- **Clima** determinístico em ciclo de 24 h: ensolarado, parcialmente nublado, nublado, chuva leve, chuva intensa, seca e onda de calor.
- **Evapotranspiração de referência (ET₀)** horária pelo método FAO-56 Penman-Monteith simplificado e **ETc = ET₀ × Kc × Ks**.
- **Balanço hídrico do solo** de zona radicular única: irrigação, chuva, infiltração, escoamento, evapotranspiração e drenagem, com solos arenoso, franco e argiloso.
- **Hidráulica**: vazão, pressão, vazamentos, obstrução de gotejadores e intertravamento da bomba.
- **Reservatório** com reposição automática, perdas e alertas de nível.
- **Energia**: consumo de bomba, controlador, sensores e válvulas, com painéis solares opcionais.
- **Desenvolvimento das plantas** em seis estágios (muda → produção), afetado por água, temperatura e estresse.

### Modos de irrigação

| Modo | Comportamento |
|---|---|
| Manual | O usuário controla bomba e válvulas. |
| Programado | Horário fixo, independente do clima. |
| Automático | Irriga por setor conforme a umidade, com histerese. |
| Inteligente | Considera previsão de chuva, evapotranspiração, janela horária e disponibilidade de água. |
| Otimizado | Controle por zonas, validação cruzada de sensores, detecção de vazamento e metas baseadas em ETc. |

### Cenários experimentais
Cinco cenários executados no mesmo clima: convencional, programada, por sensores, inteligente e otimizada. As economias exibidas são **calculadas a partir dos resultados do motor**, nunca fixas, e valem apenas para as condições simuladas.

### Outros recursos
- **Alertas** com horário, local, gravidade, descrição e recomendação, filtráveis por gravidade e categoria.
- **Gráficos** em tempo simulado: umidade, temperatura, consumo de água, energia, reservatório, bomba, irrigações e desenvolvimento.
- **Simulador de falhas**: sensor desconectado ou com leitura errada, bomba com falha, vazamento, reservatório vazio, falha elétrica, falta de comunicação e gotejador obstruído.
- **Celular**: interface que simula o acesso remoto por smartphone.
- **Relatórios** com exportação em **CSV**.
- **Modo de apresentação**: demonstração guiada com período seco, irrigação automática, recuperação da umidade e comparação de consumo.

## Tecnologias

React · TypeScript · Vite · Three.js / React Three Fiber · Recharts · Zustand

## Como executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
```

## Estrutura

```
src/
├── engine/   # motor de simulação (clima, ET₀, solo, sensores, controle, alertas, cenários)
├── store/    # estado da aplicação
├── three/    # visualização 3D
└── ui/       # painéis e componentes de interface
```

A lógica de cálculo é totalmente separada da interface e da visualização 3D. A arquitetura foi pensada para futura integração com dispositivos IoT reais, mas nesta versão **não há backend**.

## Licença

Defina a licença antes de distribuir.
