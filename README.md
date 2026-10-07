# 🏛️ Sistema de Compensação de Horário

Sistema web desenvolvido para substituir planilhas manuais de controle de **Sobra de Horas (Horas Trabalhadas)** e **Horas Tiradas (Compensação)** da Secretaria da Educação / Prefeitura Municipal de Lajeado.

---

## 🎨 Principais Funcionalidades

1. **Interface Moderna Azul & Branco:**
   - Visual limpo, profissional e ergonômico.
   - Indicadores visuais em tempo real de saldo positivo (crédito) e saldo negativo (débito).

2. **Cálculo Automático de Horas:**
   - Cálculo instantâneo do tempo trabalhado ou compensado ao digitar hora de início e término.
   - Totalizadores automáticos: Total de Horas Trabalhadas, Total de Horas Faltantes e Saldo Líquido.

3. **Lançamento Rápido:**
   - Botão de atalho para a data de hoje.
   - Botões com atalhos para justificativas recorrentes:
     - *Auxílio a pedido da equipe diretiva*
     - *Mini curso online*
     - *Seminário SIM*
     - *Reunião pedagógica*
     - *Reunião de turma*
     - *Encontro formativo*
     - *Entrega de portfólio na escola*

4. **Impressão Oficial & PDF (Modelo Idêntico à Folha da SMED):**
   - Botão **"🖨️ Imprimir / PDF Oficial"** gera o documento A4 exatamente formatado como o modelo oficial da Prefeitura de Lajeado, pronto para impressão ou para salvar como PDF, contendo cabeçalho, tabelas lado a lado, totais, campos de data/responsável e campos para assinatura do servidor e da direção.

5. **Exportação & Backup:**
   - **Exportar Excel (.xlsx):** Baixa o arquivo pronto para abrir no Excel formatado.
   - **Exportar CSV:** Para compatibilidade universal.
   - **Backup & Restauração:** Salve um arquivo JSON no seu computador e restaure quando quiser.
   - **Dados Salvos Localmente:** Todos os dados ficam salvos de forma segura no navegador (`localStorage`), sem depender de internet.

6. **Multi-Servidores:**
   - Permite cadastrar e alternar entre diferentes servidores, mantendo as fichas organizadas por servidor, EMEI e ano.

---

## 🚀 Como Executar

Basta dar **duplo clique** no arquivo:
- `abrir_sistema.bat` ou
- `index.html`

O sistema abrirá imediatamente em qualquer navegador (Google Chrome, Microsoft Edge, Firefox, etc.), sem precisar instalar Node, Python ou qualquer outro programa!
