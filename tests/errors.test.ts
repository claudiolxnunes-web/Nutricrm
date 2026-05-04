import { describe, it, expect } from "vitest";
import { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from "../shared/_core/errors";

describe("HttpError", () => {
  it("cria erro com statusCode e mensagem corretos", () => {
    const err = new HttpError(400, "campo inválido");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("campo inválido");
    expect(err.name).toBe("HttpError");
  });

  it("é instância de Error", () => {
    const err = new HttpError(500, "erro interno");
    expect(err instanceof Error).toBe(true);
  });
});

describe("BadRequestError", () => {
  it("cria erro 400", () => {
    const err = BadRequestError("bad");
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("bad");
  });
});

describe("UnauthorizedError", () => {
  it("cria erro 401", () => {
    const err = UnauthorizedError("sem autenticação");
    expect(err.statusCode).toBe(401);
  });
});

describe("ForbiddenError", () => {
  it("cria erro 403", () => {
    const err = ForbiddenError("proibido");
    expect(err.statusCode).toBe(403);
  });
});

describe("NotFoundError", () => {
  it("cria erro 404", () => {
    const err = NotFoundError("não encontrado");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("não encontrado");
  });
});
