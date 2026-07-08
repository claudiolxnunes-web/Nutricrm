import { GoogleGenerativeAI } from "@google/generative-ai";
import { ENV } from "./env";

export interface ExpectedField {
  key: string;
  /** Nomes/aliases comuns já conhecidos para essa coluna, usados como dica para a IA */
  aliases?: string[];
}

export interface SuggestColumnMappingResult {
  /** key do campo -> nome exato do header encontrado no arquivo (ou undefined se não encontrado) */
  mapping: Record<string, string>;
  source: "gemini" | "fallback";
  error?: string;
}

const MODEL_CANDIDATES = ["gemini-2.0-flash", "gemini-1.5-flash"];

function buildPrompt(headers: string[], fields: ExpectedField[], tipo: "vendas" | "pedidos"): string {
  const fieldsDescription = fields
    .map(f => `- "${f.key}"${f.aliases && f.aliases.length ? ` (exemplos de nomes comuns: ${f.aliases.slice(0, 6).join(", ")})` : ""}`)
    .join("\n");

  return `Você é um assistente que mapeia colunas de uma planilha Excel de ${tipo === "vendas" ? "vendas faturadas" : "pedidos em carteira"} de uma empresa de nutrição animal para um conjunto de campos internos do sistema (CRM).

Os cabeçalhos (headers) reais encontrados no arquivo Excel, na ordem em que aparecem, são:
${JSON.stringify(headers)}

Os campos internos esperados pelo sistema são:
${fieldsDescription}

Para cada campo interno, identifique qual header da planilha melhor corresponde a ele, com base no significado semântico (nem sempre o nome é idêntico). Um mesmo header NÃO deve ser usado para mais de um campo. Se nenhum header corresponder a um campo, omita esse campo do resultado.

Responda APENAS com um objeto JSON válido, sem nenhum texto adicional, no formato:
{"campo_interno": "Nome Exato do Header", ...}

Use exatamente o texto do header como aparece na lista acima (não invente nem modifique).`;
}

function extractJson(text: string): any {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(cleaned);
}

/**
 * Usa o Gemini (Google AI) para sugerir o mapeamento entre os headers reais de um
 * arquivo Excel e os campos internos esperados pelo sistema. Retorna null caso a
 * API key não esteja configurada ou a chamada falhe — quem chamar deve usar o
 * mapeamento hardcoded como fallback nesses casos.
 */
export async function suggestColumnMapping(
  headers: string[],
  fields: ExpectedField[],
  tipo: "vendas" | "pedidos"
): Promise<SuggestColumnMappingResult> {
  if (!ENV.geminiApiKey) {
    return { mapping: {}, source: "fallback", error: "GEMINI_API_KEY não configurada" };
  }

  const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
  const prompt = buildPrompt(headers, fields, tipo);

  let lastError: unknown;
  for (const modelName of MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = extractJson(text);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Resposta da IA não é um objeto JSON válido");
      }

      const headerSet = new Set(headers);
      const mapping: Record<string, string> = {};
      const validKeys = new Set(fields.map(f => f.key));

      for (const [key, value] of Object.entries(parsed)) {
        if (!validKeys.has(key)) continue;
        if (typeof value !== "string") continue;
        if (headerSet.has(value)) {
          mapping[key] = value;
        }
      }

      return { mapping, source: "gemini" };
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  return {
    mapping: {},
    source: "fallback",
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}
