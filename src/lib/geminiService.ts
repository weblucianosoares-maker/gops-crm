import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const extractNetworkData = async (fileBuffer: Buffer, mimeType: string, carrierName: string) => {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    Você é um especialista em processamento de documentos de seguros de saúde.
    Sua tarefa é extrair uma lista estruturada de estabelecimentos de saúde (Hospitais, Clínicas e Laboratórios) deste documento da operadora ${carrierName}.

    REGRAS DE EXTRAÇÃO:
    1. Identifique o Nome Completo do estabelecimento.
    2. Identifique o TIPO: Deve ser obrigatoriamente um destes: 'Hospital', 'Clínica' ou 'Laboratório'.
    3. Identifique a CIDADE e UF.
    4. Se houver informações de bairro ou endereço, extraia também.
    5. Identifique quais PRODUTOS/PLANOS são mencionados (ex: "Amil S380", "Amil S450", "Top Nacional").
    
    SAÍDA:
    Retorne APENAS um JSON puro no seguinte formato, sem explicações:
    [
      {
        "name": "Nome do Estabelecimento",
        "type": "Hospital",
        "uf": "RJ",
        "city": "Niterói",
        "neighborhood": "Icaraí",
        "address": "Rua Exemplo, 123",
        "products": ["Plano A", "Plano B"]
      }
    ]

    Se não encontrar produtos específicos, deixe a lista de produtos vazia.
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
