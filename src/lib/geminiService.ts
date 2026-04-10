import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
