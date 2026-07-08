import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
};

vi.mock("../server/_core/env", () => ({
  ENV: {
    DATABASE_URL: "postgres://test:test@localhost:5432/test",
    JWT_SECRET: "test-secret",
    RESEND_API_KEY: "",
    STRIPE_SECRET_KEY: "",
    STRIPE_WEBHOOK_SECRET: "",
    VAPID_PUBLIC_KEY: "",
    VAPID_PRIVATE_KEY: "",
    OPENAI_API_KEY: "",
    NODE_ENV: "test",
    databaseUrl: "postgres://test:test@localhost:5432/test",
  },
}));

vi.mock("pg", () => ({
  Pool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    }),
    end: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
}));

describe("importSalesData / importPedidosData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("importa venda nova e ignora duplicada pelo importKey", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockResolvedValueOnce([]) // findRepresentanteIdByName -> não encontrado
        .mockResolvedValueOnce([]) // findClienteId -> não encontrado
        .mockResolvedValueOnce([]) // findProdutoId -> não encontrado
        .mockResolvedValueOnce([]) // dedupe da venda (row1) -> não existe
        .mockResolvedValueOnce([{ id: 999 }]), // dedupe da venda (row2) -> já existe
    };

    const insertValues = vi
      .fn()
      .mockImplementationOnce(() => ({ returning: vi.fn().mockResolvedValue([{ id: 50 }]) })) // insert users (representante)
      .mockImplementationOnce(() => ({ returning: vi.fn().mockResolvedValue([{ id: 10 }]) })) // insert clients
      .mockImplementationOnce(() => ({ returning: vi.fn().mockResolvedValue([{ id: 20 }]) })) // insert products
      .mockImplementationOnce(() => Promise.resolve(undefined)); // insert sales

    mockDb.select.mockReturnValue(selectChain);
    mockDb.insert.mockReturnValue({ values: insertValues });

    const { importSalesData } = await import("../server/db");

    const baseRow = {
      codCliente: "C001",
      codProduto: "P001",
      dataNF: "2026-05-10",
      qtdeSacos: 30,
      precoSaco: 50,
      representante: "Rep1",
      nomeCliente: "Cliente 1",
      nomeProduto: "Produto 1",
      municipio: "",
      uf: "",
      notaFiscal: "NF-1",
      pedido: "PED-1",
    };

    const result = await importSalesData(
      [baseRow, baseRow] as any,
      1,
      99,
    );

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.details.vendas.created).toBe(1);
    expect(result.details.vendas.existing).toBe(1);
    expect(result.details.representantes.created).toBe(1);
    expect(result.details.clientes.created).toBe(1);
    expect(result.details.produtos.created).toBe(1);

    // Apenas 4 inserts: representante, cliente, produto, venda (a venda duplicada não deve gerar insert)
    expect(insertValues).toHaveBeenCalledTimes(4);
    const saleInsertCall = insertValues.mock.calls[3][0];
    expect(saleInsertCall).toMatchObject({
      companyId: 1,
      clientId: 10,
      createdBy: 99,
      notaFiscal: "NF-1",
      pedidoNumber: "PED-1",
      totalValue: "1500",
      finalValue: "1500",
      volumeSacos: "30",
    });
  });

  it("importa pedido novo e ATUALIZA (upsert) quando já existe pelo importKey", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockResolvedValueOnce([]) // findRepresentanteIdByName -> não encontrado
        .mockResolvedValueOnce([]) // findClienteId -> não encontrado
        .mockResolvedValueOnce([]) // findProdutoId -> não encontrado
        .mockResolvedValueOnce([]) // upsert do pedido (row1) -> não existe -> insert
        .mockResolvedValueOnce([{ id: 123 }]), // upsert do pedido (row2) -> já existe -> update
    };

    const insertValues = vi
      .fn()
      .mockImplementationOnce(() => ({ returning: vi.fn().mockResolvedValue([{ id: 77 }]) })) // insert users (representante)
      .mockImplementationOnce(() => ({ returning: vi.fn().mockResolvedValue([{ id: 10 }]) })) // insert clients
      .mockImplementationOnce(() => ({ returning: vi.fn().mockResolvedValue([{ id: 30 }]) })) // insert products
      .mockImplementationOnce(() => Promise.resolve(undefined)); // insert pedidosCarteira (row1)

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

    mockDb.select.mockReturnValue(selectChain);
    mockDb.insert.mockReturnValue({ values: insertValues });
    mockDb.update.mockReturnValue({ set: updateSet });

    const { importPedidosData } = await import("../server/db");

    const baseRow = {
      codCliente: "C001",
      nomeCliente: "Cliente 1",
      codProduto: "P001",
      nomeProduto: "Produto 1",
      dataPedido: "2026-05-11",
      qtdeSacos: 40,
      precoSaco: 50,
      pedidoNumber: "PED-77",
      representante: "Maria",
    };

    const result = await importPedidosData(
      [baseRow, baseRow] as any,
      1,
      99,
    );

    expect(result.success).toBe(true);
    // Ambas as linhas contam como "importadas" (upsert): a primeira cria, a
    // segunda atualiza o registro existente em vez de ser ignorada.
    expect(result.imported).toBe(2);
    expect(result.errors).toBe(0);
    expect(result.details.vendas.created).toBe(1);
    expect(result.details.vendas.existing).toBe(1);
    expect(result.details.representantes.created).toBe(1);
    expect(result.details.clientes.created).toBe(1);
    expect(result.details.produtos.created).toBe(1);

    expect(insertValues).toHaveBeenCalledTimes(4);
    const pedidoInsertCall = insertValues.mock.calls[3][0];
    expect(pedidoInsertCall).toMatchObject({
      companyId: 1,
      clientId: 10,
      createdBy: 99,
      pedidoNumber: "PED-77",
      totalValue: "2000",
      qtdeSacos: 40,
      precoSaco: "50",
      representante: "Maria",
      status: "pendente",
    });

    // Segunda linha (duplicada pelo importKey) deve disparar UPDATE, não um
    // segundo insert — é isso que garante o comportamento de upsert.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledTimes(1);
    const pedidoUpdateCall = updateSet.mock.calls[0][0];
    expect(pedidoUpdateCall).toMatchObject({
      companyId: 1,
      clientId: 10,
      pedidoNumber: "PED-77",
      totalValue: "2000",
      qtdeSacos: 40,
      precoSaco: "50",
      representante: "Maria",
    });
  });

});
