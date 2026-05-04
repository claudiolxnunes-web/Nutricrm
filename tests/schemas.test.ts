import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Schemas extraídos dos routers ────────────────────────────────────────────

const createClientSchema = z.object({
  clientType: z
    .enum(["fazenda", "revendedor", "distribuidor", "agroindustria", "fabrica_racoes"])
    .optional()
    .default("fazenda"),
  farmName: z.string().min(1),
  producerName: z.string().min(1),
  email: z
    .string()
    .optional()
    .transform((v) => (v && v.includes("@") ? v : undefined)),
  animalType: z.enum(["bovinos", "suinos", "aves", "equinos", "outros"]),
  score: z.number().min(0).max(100).optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  stock: z.number().optional(),
  unit: z.string().optional().default("kg"),
  active: z.boolean().optional().default(true),
});

const createOpportunitySchema = z.object({
  clientId: z.number(),
  title: z.string().min(1),
  stage: z
    .enum(["prospeccao", "visita_tecnica", "orcamento_enviado", "negociacao", "venda_concluida", "perdida"])
    .optional()
    .default("prospeccao"),
  value: z.string().optional(),
  probability: z.number().optional(),
});

const updateQuoteSchema = z.object({
  id: z.number(),
  status: z.enum(["rascunho", "enviado", "aceito", "rejeitado", "expirado"]).optional(),
  discount: z.string().optional(),
  notes: z.string().optional(),
});

const createInteractionSchema = z.object({
  clientId: z.number(),
  type: z.enum(["visita", "ligacao", "email", "nota", "reuniao"]),
  title: z.string().min(1),
  description: z.string().optional(),
  duration: z.number().optional(),
});

const createSaleSchema = z.object({
  clientId: z.number(),
  totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
  saleDate: z.date(),
  paymentStatus: z.enum(["pago", "parcial", "pendente"]).optional().default("pendente"),
});

const sendQuoteEmailSchema = z.object({
  quoteId: z.number(),
  toEmail: z.string().email().optional(),
  customMessage: z.string().optional(),
});

// ─── Testes: createClientSchema ───────────────────────────────────────────────

describe("createClientSchema", () => {
  it("aceita dados válidos mínimos", () => {
    const result = createClientSchema.safeParse({
      farmName: "Fazenda Boa Vista",
      producerName: "João Silva",
      animalType: "bovinos",
    });
    expect(result.success).toBe(true);
  });

  it("aplica default 'fazenda' para clientType", () => {
    const result = createClientSchema.parse({
      farmName: "Fazenda X",
      producerName: "Maria",
      animalType: "suinos",
    });
    expect(result.clientType).toBe("fazenda");
  });

  it("rejeita farmName vazio", () => {
    const result = createClientSchema.safeParse({
      farmName: "",
      producerName: "João",
      animalType: "aves",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita score acima de 100", () => {
    const result = createClientSchema.safeParse({
      farmName: "Fazenda Y",
      producerName: "Pedro",
      animalType: "bovinos",
      score: 101,
    });
    expect(result.success).toBe(false);
  });

  it("transforma email sem @ para undefined", () => {
    const result = createClientSchema.parse({
      farmName: "Fazenda Z",
      producerName: "Ana",
      animalType: "aves",
      email: "emailsemaroba",
    });
    expect(result.email).toBeUndefined();
  });

  it("mantém email válido com @", () => {
    const result = createClientSchema.parse({
      farmName: "Fazenda W",
      producerName: "Carlos",
      animalType: "equinos",
      email: "carlos@fazenda.com",
    });
    expect(result.email).toBe("carlos@fazenda.com");
  });

  it("rejeita animalType inválido", () => {
    const result = createClientSchema.safeParse({
      farmName: "Fazenda A",
      producerName: "Luis",
      animalType: "peixes",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Testes: createProductSchema ─────────────────────────────────────────────

describe("createProductSchema", () => {
  it("aceita produto válido", () => {
    const result = createProductSchema.safeParse({
      name: "Ração Suína",
      category: "Nutrição",
      price: "49.99",
    });
    expect(result.success).toBe(true);
  });

  it("aplica default 'kg' para unit", () => {
    const result = createProductSchema.parse({
      name: "Premix",
      category: "Suplementos",
      price: "120.00",
    });
    expect(result.unit).toBe("kg");
    expect(result.active).toBe(true);
  });

  it("rejeita preço com 3 casas decimais", () => {
    const result = createProductSchema.safeParse({
      name: "Produto",
      category: "Cat",
      price: "10.999",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita preço não numérico", () => {
    const result = createProductSchema.safeParse({
      name: "Produto",
      category: "Cat",
      price: "abc",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Testes: createOpportunitySchema ─────────────────────────────────────────

describe("createOpportunitySchema", () => {
  it("aplica default 'prospeccao' para stage", () => {
    const result = createOpportunitySchema.parse({
      clientId: 1,
      title: "Nova Oportunidade",
    });
    expect(result.stage).toBe("prospeccao");
  });

  it("rejeita title vazio", () => {
    const result = createOpportunitySchema.safeParse({
      clientId: 1,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  it("aceita stage válido", () => {
    const result = createOpportunitySchema.safeParse({
      clientId: 5,
      title: "Opp",
      stage: "venda_concluida",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Testes: updateQuoteSchema ────────────────────────────────────────────────

describe("updateQuoteSchema", () => {
  it("aceita atualização válida de status", () => {
    const result = updateQuoteSchema.safeParse({ id: 1, status: "aceito" });
    expect(result.success).toBe(true);
  });

  it("rejeita status inválido", () => {
    const result = updateQuoteSchema.safeParse({ id: 1, status: "cancelado" });
    expect(result.success).toBe(false);
  });
});

// ─── Testes: createInteractionSchema ─────────────────────────────────────────

describe("createInteractionSchema", () => {
  it("aceita interação de visita válida", () => {
    const result = createInteractionSchema.safeParse({
      clientId: 3,
      type: "visita",
      title: "Visita técnica",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita tipo de interação inválido", () => {
    const result = createInteractionSchema.safeParse({
      clientId: 3,
      type: "chamada",
      title: "Título",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Testes: createSaleSchema ─────────────────────────────────────────────────

describe("createSaleSchema", () => {
  it("aceita venda válida com default pendente", () => {
    const result = createSaleSchema.parse({
      clientId: 2,
      totalValue: "5000.00",
      saleDate: new Date(),
    });
    expect(result.paymentStatus).toBe("pendente");
  });

  it("rejeita totalValue com formato inválido", () => {
    const result = createSaleSchema.safeParse({
      clientId: 2,
      totalValue: "R$5000",
      saleDate: new Date(),
    });
    expect(result.success).toBe(false);
  });
});

// ─── Testes: sendQuoteEmailSchema ─────────────────────────────────────────────

describe("sendQuoteEmailSchema", () => {
  it("aceita dados com email válido", () => {
    const result = sendQuoteEmailSchema.safeParse({
      quoteId: 1,
      toEmail: "cliente@empresa.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email com formato inválido", () => {
    const result = sendQuoteEmailSchema.safeParse({
      quoteId: 1,
      toEmail: "email-invalido",
    });
    expect(result.success).toBe(false);
  });

  it("aceita sem email (campo opcional)", () => {
    const result = sendQuoteEmailSchema.safeParse({ quoteId: 1 });
    expect(result.success).toBe(true);
  });
});
