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
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  createOpportunity,
  getOpportunities,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  createQuote,
  getQuotes,
  getQuoteById,
  updateQuote,
  createQuoteItem,
  getQuoteItems,
  deleteQuoteItem,
  createInteraction,
  getInteractions,
  createSale,
  getSales,
  getDashboardMetrics,
  listUsers,
  updateUserRole,
  deleteUser,
  assignClientsToUser,
  getClientCountByUser,
  activateUser,
  getUserByEmail,
  createUserWithPassword,
  createCompany,
  listCompanies,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
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
      .input(
        z.object({
          search: z.string().optional(),
          animalType: z.string().optional(),
          status: z.string().optional(),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        const results = await getClients({
          ...input,
          userId: ctx.user.id,
          role: ctx.user.role,
          companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId,
        });
        return results;
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
      .input(
        z.object({
          opportunityId: z.number().optional(),
          clientId: z.number(),
          quoteNumber: z.string().min(1),
          validityDays: z.number().optional().default(30),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createQuote({
          ...input,
          createdBy: ctx.user.id,
          companyId: ctx.user.companyId,
        });
      }),

    list: protectedProcedure
      .input(
        z.object({
          clientId: z.number().optional(),
          status: z.string().optional(),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        return getQuotes({ ...input, companyId: ctx.user.role === "superadmin" ? undefined : ctx.user.companyId });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getQuoteById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["rascunho", "enviado", "aceito", "rejeitado", "expirado"]).optional(),
          discount: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateQuote(id, data as any);
      }),

    addItem: protectedProcedure
      .input(
        z.object({
          quoteId: z.number(),
          productId: z.number(),
          quantity: z.string().regex(/^\d+(\.\d{1,2})?$/),
          unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
          totalPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
        })
      )
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
          date: z.date(),
          duration: z.number().optional(),
          result: z.string().optional(),
          nextAction: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createInteraction({
          ...input,
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
  }),

  // ========== SALES ==========
  sales: router({
    create: protectedProcedure
      .input(
        z.object({
          opportunityId: z.number().optional(),
          clientId: z.number(),
          quoteId: z.number().optional(),
          saleNumber: z.string().min(1),
          totalValue: z.string().regex(/^\d+(\.\d{1,2})?$/),
          saleDate: z.date(),
          deliveryDate: z.date().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return createSale({
          ...input,
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
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["admin", "vendedor"]).default("vendedor"),
      }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
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
      .input(z.object({ planId: z.enum(["mensal", "semestral", "anual"]) }))
      .mutation(async ({ input, ctx }) => {
        return createCheckoutSession(ctx.user.id, ctx.user.email || "", input.planId);
      }),
  }),

  // ========== COMPANIES ==========
  companies: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "superadmin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado" });
      return listCompanies();
    }),
  }),
});

export type AppRouter = typeof appRouter;











