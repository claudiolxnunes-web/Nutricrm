import { z } from "zod";
import { sendInviteEmail } from "./email";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, paymentProcedure, router } from "./_core/trpc";
import { createCheckoutSession, PLANS } from "./stripe";
import {
  createClient,
  getClients, getClientsCount,
  getClientById,
  updateClient,
  deleteClient,
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  importProducts,
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  createQuoteWithItems, getQuoteWithItems,
  getQuotes,
  getQuoteById,
  updateQuote, updateQuoteStatus, deleteQuote,
  createQuoteItem,
  getQuoteItems,
  deleteQuoteItem,
  createInteraction,
  getInteractions, getAllInteractions, getUpcomingVisits, scheduleNextVisit,
  updateClientScore,
  updateClientGeo,
  getVisits,
  createSale,
  getSales,
  deleteSale,
  getDashboardMetrics,
  countUsersByCompany,
  getCompanyPlan,
  listUsers,
  updateUserRole,
  deleteUser,
  assignClientsToUser,
  getClientCountByUser,
  activateUser,
  getUserByEmail,
  createUserWithPassword,
  createCompany,
  listCompanies, listAllUsers, grantAccess, revokeAccess, setAccessUntil,
  getAiForecastData,
  setMonthlyGoal,
  getMonthlyGoal,
  getMonthlyProgress,
  getABCData,
  getOrcamentosSimples,
  createOrcamentoSimples,
} from "./db";
export const appRouter = router({
  system: systemRouter,
  auth: router({
     me: publicProcedure.query(async (opts) => { if (!opts.ctx.user) return null; const plan = await getCompanyPlan(opts.ctx.user.companyId); return { ...opts.ctx.user, companyPlan: plan }; }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ========== CLIENTS ==========
  clients: router({
    create: protectedProcedure
      .input(
        z.object({
          clientType: z.enum(["fazenda","revendedor","distribuidor","agroindustria","fabrica_racoes"]).optional().default("fazenda"),
          activityType: z.enum(["granja_aves_corte","granja_aves_postura","suinocultura_ciclo_completo","suinocultura_leitoes","suinocultura_terminacao","gado_corte_ciclo_completo","gado_corte_cria","gado_corte_recria","gado_leite_intensivo","gado_leite_semi_intensivo","gado_leite_extensivo"]).optional(),
          farmName: z.string().min(1),
          producerName: z.string().min(1),
          email: z.string().optional().transform(v => (v && v.includes("@") ? v : undefined)),
          phone: z.string().optional(),
          whatsapp: z.string().optional(),
          animalType: z.enum(["bovinos", "suinos", "aves", "equinos", "outros"]),
          animalQuantity: z.number().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipCode: z.string().optional(),
          notes: z.string().optional(),
          score: z.number().min(0).max(100).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createClient({
          ...input,
          createdBy: ctx.user.id,
          companyId: ctx.user.companyId,
        });
      }),

        list: protectedProcedure
      .input(z.object({
          search: z.string().optional(),
          animalType: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().optional().default(100),
          offset: z.number().optional().default(0),
        }))
      .query(async ({ input, ctx }) => {
        const companyId = ctx.user.role === "superadmin" ? undefined : ctx.user.companyId;
        const filters = { ...input, userId: ctx.user.id, role: ctx.user.role, companyId };
        const [data, total] = await Promise.all([getClients(filters), getClientsCount(filters)]);
        return { data, total };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getClientById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          clientType: z.enum(["fazenda","revendedor","distribuidor","agroindustria","fabrica_racoes"]).optional(),
          activityType: z.enum(["granja_aves_corte","granja_aves_postura","suinocultura_ciclo_completo","suinocultura_leitoes","suinocultura_terminacao","gado_corte_ciclo_completo","gado_corte_cria","gado_corte_recria","gado_leite_intensivo","gado_leite_semi_intensivo","gado_leite_extensivo"]).optional(),
          farmName: z.string().optional(),
          producerName: z.string().optional(),
          email: z.string().optional().transform(v => (v && v.includes("@") ? v : undefined)),
          phone: z.string().optional(),
          whatsapp: z.string().optional(),
          animalType: z.enum(["bovinos", "suinos", "aves", "equinos", "outros"]).optional(),
          animalQuantity: z.number().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          zipCode: z.string().optional(),
          notes: z.string().optional(),
          status: z.enum(["ativo", "inativo", "prospect"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateClient(id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteClient(input.id);
      }),

    assign: protectedProcedure
      .input(z.object({
        clientIds: z.array(z.number()),
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem atribuir clientes" });
        return assignClientsToUser(input.clientIds, input.userId);
      }),

    updateScore: protectedProcedure
      .input(z.object({ id: z.number(), score: z.number().min(0).max(100) }))
      .mutation(async ({ input }) => { return updateClientScore(input.id, input.score); }),

    updateGeo: protectedProcedure
      .input(z.object({ id: z.number(), lat: z.string(), lng: z.string() }))
      .mutation(async ({ input }) => { return updateClientGeo(input.id, input.lat, input.lng); }),
  }),

  // ========== PRODUCTS ==========
  products: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          category: z.string().min(1),
          description: z.string().optional(),
          price: z.string().regex(/^\d+(\.\d{1,2})?$/),
          stock: z.number().optional(),
          unit: z.string().optional().default("kg"),
          active: z.boolean().optional().default(true),
          productCode: z.string().optional(),
          species: z.string().optional(),
          phase: z.string().optional(),
          packaging: z.string().optional(),
          bagWeight: z.string().optional(),
          indication: z.string().optional(),
          usageMode: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createProduct({ ...input, companyId: ctx.user.companyId });
      }),

    list: protectedProcedure
      .input(
        z.object({
          search: z.string().optional(),
          category: z.string().optional(),
          active: z.boolean().optional(),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        return getProducts({ ...input, companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getProductById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          stock: z.number().optional(),
          unit: z.string().optional(),
          active: z.boolean().optional(),
          productCode: z.string().optional(),
          species: z.string().optional(),
          phase: z.string().optional(),
          packaging: z.string().optional(),
          bagWeight: z.string().optional(),
          indication: z.string().optional(),
          usageMode: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateProduct(id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteProduct(input.id);
      }),

    import: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          productCode: z.string().optional(),
          name: z.string(),
          packaging: z.string().optional(),
          bagWeight: z.string().optional(),
          species: z.string().optional(),
          phase: z.string().optional(),
          indication: z.string().optional(),
          usageMode: z.string().optional(),
          price: z.string().optional(),
          category: z.string().optional(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        return importProducts(input.rows, ctx.user.companyId, ctx.user.id);
      }),
  }),

  // ========== OPPORTUNITIES ==========
  opportunities: router({
    create: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          stage: z
            .enum(["prospeccao", "visita_tecnica", "orcamento_enviado", "negociacao", "venda_concluida", "perdida"])
            .optional()
            .default("prospeccao"),
          value: z.string().optional(),
          probability: z.number().optional(),
          expectedCloseDate: z.date().optional(),
          quoteId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createOpportunity({
          ...input,
          assignedTo: ctx.user.id,
          companyId: ctx.user.companyId,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          clientId: z.number().optional(),
          stage: z.string().optional(),
          assignedTo: z.number().optional(),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        return getOpportunities({
          ...input,
          assignedTo: input.assignedTo || ctx.user.id,
          companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId,
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getOpportunityById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          stage: z
            .enum(["prospeccao", "visita_tecnica", "orcamento_enviado", "negociacao", "venda_concluida", "perdida"])
            .optional(),
          value: z.string().optional(),
          probability: z.number().optional(),
          expectedCloseDate: z.date().optional(),
          quoteId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateOpportunity(id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return deleteOpportunity(input.id);
      }),
  }),

  // ========== QUOTES ==========
  quotes: router({
    create: protectedProcedure
      .input(z.object({
        opportunityId: z.number().optional(),
        clientId: z.number(),
        quoteNumber: z.string().min(1),
        validityDays: z.number().optional().default(30),
        notes: z.string().optional(),
        discount: z.number().optional().default(0),
        items: z.array(z.object({
          productId: z.union([z.number(), z.string()]).optional().transform(v => v !== undefined ? Number(v) : undefined),
          productName: z.string().optional(),
          quantity: z.union([z.string(), z.number()]).transform(v => String(v)),
          unitPrice: z.union([z.string(), z.number()]).transform(v => String(v)),
          totalPrice: z.union([z.string(), z.number()]).transform(v => String(v)),
          unit: z.string().optional(),
        })).optional().default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        const { items, discount, ...quoteData } = input;
        return createQuoteWithItems({ ...quoteData, createdBy: ctx.user.id, companyId: ctx.user.companyId }, items ?? [], discount ?? 0);
      }),

    list: protectedProcedure
      .input(z.object({
        clientId: z.number().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }))
      .query(async ({ input, ctx }) => {
        const companyFilter = ctx.user.role === "superadmin" ? ctx.user.companyId : ctx.user.companyId;
        return getQuotes({ ...input, companyId: companyFilter });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getQuoteById(input.id);
      }),

    getWithItems: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getQuoteWithItems(input.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["rascunho", "enviado", "aceito", "rejeitado", "expirado"]).optional(),
        discount: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateQuote(id, data as any);
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["rascunho","enviado","aceito","rejeitado","expirado"]) }))
      .mutation(async ({ input }) => {
        await updateQuoteStatus(input.id, input.status);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteQuote(input.id);
        return { success: true };
      }),

    addItem: protectedProcedure
      .input(z.object({
        quoteId: z.number(),
        productId: z.number(),
        quantity: z.string(),
        unitPrice: z.string(),
        totalPrice: z.string(),
      }))
      .mutation(async ({ input }) => {
        return createQuoteItem(input);
      }),

    getItems: protectedProcedure
      .input(z.object({ quoteId: z.number() }))
      .query(async ({ input }) => {
        return getQuoteItems(input.quoteId);
      }),

    removeItem: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .mutation(async ({ input }) => {
        return deleteQuoteItem(input.itemId);
      }),

    sendEmail: protectedProcedure
      .input(z.object({
        quoteId: z.number(),
        toEmail: z.string().email().optional(),
        customMessage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const quote = await getQuoteWithItems(input.quoteId);
        if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado" });

        const client = await getClientById(quote.clientId);
        if (!client) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });

        if (ctx.user.role !== "superadmin" && ctx.user.role !== "admin") {
          if ((quote as any).createdBy !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para enviar este orçamento" });
          }
        }

        const destinatario = input.toEmail || (client as any).email;
        if (!destinatario) throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente não tem email cadastrado. Informe um email manualmente." });

        const { enviarOrcamentoPorEmail } = await import("./email");
        await enviarOrcamentoPorEmail({
          to: destinatario,
          from: (ctx.user as any).email || "nutricrm@email.com",
          fromName: (ctx.user as any).name || "NutriCRM",
          quote,
          client,
          customMessage: input.customMessage,
        });

        if ((quote as any).status === "rascunho") {
          await updateQuoteStatus(input.quoteId, "enviado");
        }

        return { success: true, sentTo: destinatario };
      }),
  }),

  // ========== INTERACTIONS ==========
  interactions: router({
    create: protectedProcedure
      .input(
        z.object({
          clientId: z.number(),
          opportunityId: z.number().optional(),
          type: z.enum(["visita", "ligacao", "email", "nota", "reuniao"]),
          title: z.string().min(1),
          description: z.string().optional(),
          date: z.date().optional(),
          duration: z.number().optional(),
          result: z.string().optional(),
          nextAction: z.string().optional(),
          nextVisitDate: z.string().optional(),
          visitResult: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createInteraction({
          ...(input as any),
          date: input.date || new Date(),
          nextVisitDate: input.nextVisitDate ? new Date(input.nextVisitDate) : undefined,
          visitResult: input.visitResult || undefined,
          createdBy: ctx.user.id,
          companyId: ctx.user.companyId,
        });
      }),
    list: protectedProcedure
      .input(
        z.object({
          clientId: z.number().optional(),
          opportunityId: z.number().optional(),
          type: z.string().optional(),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        return getInteractions({ ...input, companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId });
      }),

    visits: protectedProcedure
      .input(z.object({ clientId: z.number().optional(), limit: z.number().optional().default(50) }))
      .query(async ({ input, ctx }) => {
        return getVisits({ ...input, companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId });
      }),

    all: protectedProcedure
      .input(z.object({ type: z.string().optional(), visitResult: z.string().optional(), fromDate: z.string().optional(), toDate: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        return getAllInteractions(ctx.user.companyId, {
          type: input.type,
          visitResult: input.visitResult,
          fromDate: input.fromDate ? new Date(input.fromDate) : undefined,
          toDate: input.toDate ? new Date(input.toDate) : undefined,
        });
      }),

    upcoming: protectedProcedure
      .input(z.object({ fromDate: z.string(), toDate: z.string() }))
      .query(async ({ input, ctx }) => {
        return getUpcomingVisits(ctx.user.companyId, new Date(input.fromDate), new Date(input.toDate));
      }),

    schedule: protectedProcedure
      .input(z.object({ interactionId: z.number(), nextVisitDate: z.string(), visitResult: z.string() }))
      .mutation(async ({ input }) => {
        await scheduleNextVisit(input.interactionId, new Date(input.nextVisitDate), input.visitResult);
        return { success: true };
      }),
  }),

  // ========== SALES ==========
  sales: router({
    create: protectedProcedure
      .input(
        z.object({
          opportunityId: z.number().optional(),
          clientId: z.number(),
          quoteId: z.number().optional(),
          saleNumber: z.string().optional(),
          totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
          saleDate: z.date(),
          deliveryDate: z.date().optional(),
          notes: z.string().optional(),
          paymentStatus: z.enum(["pago","parcial","pendente"]).optional().default("pendente"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createSale({
          ...input,
          saleNumber: input.saleNumber || `VENDA-${Date.now()}`,
          createdBy: ctx.user.id,
          companyId: ctx.user.companyId,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          clientId: z.number().optional(),
          paymentStatus: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        return getSales({
          ...input,
          companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId,
        });
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return deleteSale(input.id, ctx.user.companyId);
      }),
  }),

  // ========== DASHBOARD ==========
  dashboard: router({
    metrics: protectedProcedure.query(async ({ ctx }) => {
      return getDashboardMetrics(ctx.user.id, ctx.user.role === "superadmin" ? undefined : ctx.user.companyId);
    }),
  }),

  // ========== USERS ==========
  users: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      const companyFilter = ctx.user.role === "superadmin" ? undefined : ctx.user.companyId;
      const userList = await listUsers(companyFilter);
      const counts = await getClientCountByUser();
      const countMap = Object.fromEntries(counts.map((c: any) => [c.assignedTo, c.count]));
      return userList.map((u: any) => ({ ...u, clientCount: countMap[u.id] || 0 }));
    }),
    updateRole: protectedProcedure
      .input(z.object({ id: z.number(), role: z.enum(["admin", "vendedor"]) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Nao pode alterar seu proprio role" });
        await updateUserRole(input.id, input.role);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Nao pode excluir a si mesmo" });
        await deleteUser(input.id);
        return { success: true };
      }),
    activate: protectedProcedure
      .input(z.object({ id: z.number(), days: z.number().default(30) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        return activateUser(input.id, input.days);
      }),
    resetPassword: protectedProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        const cryptoMod = await import("crypto");
        const passwordHash = cryptoMod.createHash("sha256").update(input.newPassword + "nutricrm-salt").digest("hex");
        const { getDb } = await import("./db");
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, input.userId));
        return { success: true };
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "vendedor"]).default("vendedor"),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        if (ctx.user.role !== "superadmin") {
          const { PLAN_LIMITS } = await import("./stripe");
          const plan = await getCompanyPlan(ctx.user.companyId);
          const limit = PLAN_LIMITS[plan] ?? 1;
          const current = await countUsersByCompany(ctx.user.companyId);
          if (current >= limit) throw new TRPCError({ code: "FORBIDDEN", message: `Limite do plano ${plan} atingido (${limit} usuarios). Faca upgrade para adicionar mais representantes.` });
        }
        const cryptoMod = await import("crypto");
        const passwordHash = cryptoMod.createHash("sha256").update(input.password + "nutricrm-salt").digest("hex");
        const existing = await getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email ja cadastrado" });
        const user = await createUserWithPassword({ name: input.name, email: input.email, passwordHash, companyId: ctx.user.companyId });
        if (input.role !== "vendedor") await updateUserRole(user.id, input.role);
        return { success: true };
      }),
  }),

  // ========== PAYMENTS ==========
  payments: router({
    plans: publicProcedure.query(() => {
      return PLANS.map(p => ({ id: p.id, name: p.name, label: p.label, badge: p.badge, description: p.description, days: p.days }));
    }),
    createCheckout: paymentProcedure
      .input(z.object({ planId: z.enum(["individual_mensal","individual_semestral","individual_anual","equipe_mensal","equipe_semestral","equipe_anual","empresa_mensal","empresa_semestral","empresa_anual","mensal","semestral","anual"]) }))
      .mutation(async ({ input, ctx }) => {
        return createCheckoutSession(ctx.user.id, ctx.user.email || "", input.planId as any);
      }),
  }),

  // ========== COMPANIES ==========
  companies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      return listCompanies();
    }),
  }),

  // ========== MONTHLY GOALS ==========
  goals: router({
    set: protectedProcedure
      .input(z.object({ month: z.string(), goalValue: z.string() }))
      .mutation(async ({ input, ctx }) => {
        return setMonthlyGoal(ctx.user.companyId ?? 1, input.month, input.goalValue);
      }),
    get: protectedProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ input, ctx }) => {
        return getMonthlyGoal(ctx.user.companyId ?? 1, input.month);
      }),
    progress: protectedProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ input, ctx }) => {
        return getMonthlyProgress(ctx.user.companyId ?? 1, input.month);
      }),
    abc: protectedProcedure
      .query(async ({ ctx }) => {
        const cid = ctx.user.role === "superadmin" ? 1 : (ctx.user.companyId ?? 1);
        return getABCData(cid);
      }),
  }),


  // ========== SUPERADMIN ==========
  superadmin: router({
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      return listAllUsers();
    }),
    grantAccess: protectedProcedure
      .input(z.object({ userId: z.number(), days: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        return grantAccess(input.userId, input.days);
      }),
    revokeAccess: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        await revokeAccess(input.userId);
        return { success: true };
      }),
    setUntil: protectedProcedure
      .input(z.object({ userId: z.number(), until: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
        await setAccessUntil(input.userId, new Date(input.until));
        return { success: true };
      }),
  }),  // ========== AI FORECAST ==========
  ai: router({
    forecast: protectedProcedure.query(async ({ ctx }) => {
      const companyId = ctx.user.role === "superadmin" ? undefined : ctx.user.companyId;
      return getAiForecastData(companyId);
    }),
  }),

  // ===== ORÇAMENTOS SIMPLES =====
  orcamentosSimples: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const companyId = ctx.user.role === "superadmin" ? undefined : ctx.user.companyId;
        return getOrcamentosSimples(companyId, ctx.user.id);
      }),
    create: protectedProcedure
      .input(z.object({
        clienteNome: z.string().min(1),
        clienteEmail: z.string().email().optional(),
        produtos: z.array(z.object({
          nome: z.string(),
          quantidade: z.number(),
          preco: z.number(),
          total: z.number(),
        })),
        total: z.number(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return createOrcamentoSimples({
          userId: ctx.user.id,
          companyId: ctx.user.companyId,
          clienteNome: input.clienteNome,
          clienteEmail: input.clienteEmail,
          produtos: input.produtos,
          total: input.total,
          status: input.status,
        });
      }),
  }),

});

export type AppRouter = typeof appRouter;
