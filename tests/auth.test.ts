import { describe, it, expect } from "vitest";
import { getUserAccessStatus } from "../server/db";

describe("getUserAccessStatus", () => {
  it("retorna active=true e reason='paid' quando paidUntil é no futuro", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // +30 dias
    const status = getUserAccessStatus({ paidUntil: future });
    expect(status.active).toBe(true);
    expect(status.reason).toBe("paid");
  });

  it("retorna active=true e reason='trial' quando trialEndsAt é no futuro", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // +5 dias
    const status = getUserAccessStatus({ trialEndsAt: future });
    expect(status.active).toBe(true);
    expect(status.reason).toBe("trial");
  });

  it("retorna daysLeft positivo durante trial", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // +7 dias
    const status = getUserAccessStatus({ trialEndsAt: future });
    expect(status.daysLeft).toBeGreaterThan(0);
  });

  it("retorna active=false quando paidUntil é no passado e sem trial", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24); // -1 dia
    const status = getUserAccessStatus({ paidUntil: past });
    expect(status.active).toBe(false);
    expect(status.reason).toBe("expired");
  });

  it("retorna active=false quando trialEndsAt é no passado", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3); // -3 dias
    const status = getUserAccessStatus({ trialEndsAt: past });
    expect(status.active).toBe(false);
  });

  it("retorna active=false quando ambos são nulos", () => {
    const status = getUserAccessStatus({ trialEndsAt: null, paidUntil: null });
    expect(status.active).toBe(false);
    expect(status.reason).toBe("expired");
  });

  it("prefere paidUntil sobre trialEndsAt quando ambos no futuro", () => {
    const future30 = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const future5 = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5);
    const status = getUserAccessStatus({ paidUntil: future30, trialEndsAt: future5 });
    expect(status.reason).toBe("paid");
  });

  it("retorna daysLeft=null para usuário pago", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const status = getUserAccessStatus({ paidUntil: future });
    expect(status.daysLeft).toBeNull();
  });

  it("retorna daysLeft=0 para usuário expirado", () => {
    const status = getUserAccessStatus({ trialEndsAt: null, paidUntil: null });
    expect(status.daysLeft).toBe(0);
  });
});
