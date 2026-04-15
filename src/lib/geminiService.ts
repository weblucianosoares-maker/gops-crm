import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export const extractNetworkData = async (fileBuffer: Buffer, mimeType: string, carrierName: string) => {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    Você é um especialista em processamento de documentos de seguros de saúde brasileiros.
    Sua tarefa é extrair uma lista estruturada de estabelecimentos de saúde deste documento da operadora ${carrierName}.

    REGRAS DE EXTRAÇÃO:
    1. Nome: Identifique o Nome Completo do estabelecimento.
    2. Tipo: Deve ser 'Hospital', 'Clínica' ou 'Laboratório'.
    3. Cidade/UF: Extraia a cidade e o estado.
    4. Endereço: BUSQUE ATIVAMENTE o endereço completo (Rua, Número, Bairro). Se não houver no papel mas for um hospital famoso na cidade citada, pode usar seu conhecimento para preencher.
    5. Cobertura (Siglas): Identifique as siglas de especialidade atendidas para cada plano (ex: "H", "M", "PSA", "PSI", "HE"). Elas costumam estar ao lado do nome do hospital ou em colunas específicas.
    6. Produtos: Liste os nomes dos planos/produtos que aceitam o local.
    
    SAÍDA:
    Retorne APENAS um JSON puro no seguinte formato:
    [
      {
        "name": "Nome do Estabelecimento",
        "type": "Hospital",
        "uf": "RJ",
        "city": "Niterói",
        "neighborhood": "Icaraí",
        "address": "Rua Exemplo, 123",
        "products": [
          {"name": "Plano A", "modality": "PME"},
          {"name": "Plano B", "modality": "Adesão"}
        ],
        "coverage_details": "H/ M/ PSA/ PSI" 
      }
    ]

    Se não houver siglas de cobertura, deixe "coverage_details" como "*NE" (Atendimento Não Especificado).
    Se não conseguir determinar a modalidade, use "PME" como padrão.
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType
      }
    },
    prompt
  ]);

  const response = await result.response;
  const text = response.text();
  
  // Limpar possível markdown do JSON
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  throw new Error("Não foi possível extrair dados estruturados do documento.");
};
export const processInterviewStep = async (chatHistory: { role: "user" | "model"; parts: { text: string }[] }[], leadContext?: any) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const systemPrompt = `
    Você é um Consultor Especialista em Planos de Saúde Brasileiro da "Efraim Saúde".
    Sua missão é guiar o consultor de vendas em uma entrevista com um novo Lead para coletar dados e sugerir o melhor plano.

    REGRAS DE NEGÓCIO IMPORTANTES QUE VOCÊ DEVE SABER:
    1. CNPJ: Empresas normais precisam de 90 dias de abertura. MEI precisa de 180 dias. Isso muda as operadoras disponíveis.
    2. ADESÃO: Se o lead não tem CNPJ, você DEVE buscar a PROFISSÃO ou FORMAÇÃO. Existem tabelas especiais para entidades de classe (Ex: Engenheiros, Professores, Médicos, Servidores).
    3. CARÊNCIA: Saber se tem plano atual (Operadora, Produto, Valor) é crucial para oferecer redução de carência.
    4. SAÚDE: Pergunte sobre doenças preexistentes e cirurgias planejadas (essencial para declaração de saúde).

    OBJETIVO DA CONVERSA:
    Extrair os seguintes campos enquanto sugere a PRÓXIMA PERGUNTA lógica:
    - name, phone (whatsapp), email, address, age
    - lead_type (PF ou PJ), cnpj (se PJ), profession (se PF)
    - interested_lives (vidas)
    - has_current_plan, current_carrier, current_product, current_value, current_lives
    - preferred_hospital (hospitais de preferência)
    - pre_existing_condition (doenças/cirurgias)

    SAÍDA ESPERADA (JSON apenas):
    {
      "next_question": "Sua sugestão de pergunta para o consultor fazer ao lead agora",
      "extracted_data": {
        "name": "...",
        "phone": "...",
        ... (campos que você conseguir identificar ou atualizar)
      },
      "is_finished": true/false (true apenas quando tiver todos os dados essenciais),
      "analysis": "Breve nota interna para o consultor sobre o que você percebeu (ex: 'Lead sensível a preço')",
      "recommendation": "Se is_finished for true, sugira o tipo de plano ideal (ex: 'Plano PME via CNPJ para redução de custo')"
    }

    DICAS:
    - Não peça tudo de uma vez. Seja conversacional mas focado.
    - Se o consultor digitar um CNPJ, valide se você extraiu os 14 dígitos.
    - Se o consultor digitar um endereço, tente extrair CEP, RUA e CIDADE.
  `;

  const chat = model.startChat({
    history: chatHistory,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const result = await chat.sendMessage(leadContext ? `Iniciando nova entrevista. Contexto inicial: ${JSON.stringify(leadContext)}. ${systemPrompt}` : systemPrompt);
  const response = await result.response;
  return JSON.parse(response.text());
};
