import { describe, it, expect } from "vitest";
import {
  formatDateBR,
  formatDateTimeBR,
  formatCurrencyBR,
  isoToBR,
  brToISO,
  getTodayISO,
} from "../client/src/lib/dateUtils";

describe("formatDateBR", () => {
  it("formata data válida em pt-BR", () => {
    const result = formatDateBR(new Date(2024, 0, 15)); // 15/01/2024
    expect(result).toMatch(/15\/01\/2024/);
  });

  it("retorna string vazia para null", () => {
    expect(formatDateBR(null)).toBe("");
  });

  it("retorna string vazia para undefined", () => {
    expect(formatDateBR(undefined)).toBe("");
  });

  it("aceita string ISO e retorna data formatada em pt-BR", () => {
    // "2024-06-20" pode ser interpretado como UTC, então a data exibida
    // depende do fuso local — verificamos apenas o formato DD/MM/AAAA
    const result = formatDateBR("2024-06-20");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("retorna string vazia para data inválida", () => {
    expect(formatDateBR("not-a-date")).toBe("");
  });
});

describe("formatDateTimeBR", () => {
  it("retorna string vazia para null", () => {
    expect(formatDateTimeBR(null)).toBe("");
  });

  it("retorna string para data válida", () => {
    const result = formatDateTimeBR(new Date(2024, 0, 15, 10, 30));
    expect(result).toContain("2024");
  });
});

describe("formatCurrencyBR", () => {
  it("formata número como moeda BRL", () => {
    expect(formatCurrencyBR(1000)).toBe("R$ 1.000,00");
  });

  it("formata string numérica como moeda BRL", () => {
    expect(formatCurrencyBR("250.5")).toBe("R$ 250,50");
  });

  it("retorna R$ 0,00 para null", () => {
    expect(formatCurrencyBR(null)).toBe("R$ 0,00");
  });

  it("retorna R$ 0,00 para undefined", () => {
    expect(formatCurrencyBR(undefined)).toBe("R$ 0,00");
  });

  it("retorna R$ 0,00 para string não numérica", () => {
    expect(formatCurrencyBR("abc")).toBe("R$ 0,00");
  });
});

describe("isoToBR", () => {
  it("converte YYYY-MM-DD para DD/MM/YYYY", () => {
    expect(isoToBR("2024-03-25")).toBe("25/03/2024");
  });

  it("retorna string vazia para input vazio", () => {
    expect(isoToBR("")).toBe("");
  });

  it("retorna string vazia quando partes estão ausentes", () => {
    // string com apenas ano — partes month/day ficam undefined
    expect(isoToBR("2024")).toBe("");
  });
});

describe("brToISO", () => {
  it("converte DD/MM/YYYY para YYYY-MM-DD", () => {
    expect(brToISO("25/03/2024")).toBe("2024-03-25");
  });

  it("retorna string vazia para input vazio", () => {
    expect(brToISO("")).toBe("");
  });

  it("adiciona zero à esquerda no mês e dia", () => {
    expect(brToISO("05/01/2024")).toBe("2024-01-05");
  });
});

describe("getTodayISO", () => {
  it("retorna data no formato YYYY-MM-DD", () => {
    const result = getTodayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("retorna a data de hoje", () => {
    const result = getTodayISO();
    const today = new Date().toISOString().split("T")[0];
    expect(result).toBe(today);
  });
});
