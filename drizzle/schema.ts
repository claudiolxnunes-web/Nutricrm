import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  datetime,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access control for CRM.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "vendedor"]).default("vendedor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Clientes - Produtores rurais, revendedores, distribuidores e outros
 */
export const clients = mysqlTable(
  "clients",
  {
    id: int("id").autoincrement().primaryKey(),
    clientType: varchar("clientType", { length: 50 }).default("fazenda").notNull(),
    farmName: varchar("farmName", { length: 255 }).notNull(),
    producerName: varchar("producerName", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    phone: varchar("phone", { length: 20 }),
    whatsapp: varchar("whatsapp", { length: 20 }),
    animalType: mysqlEnum("animalType", ["bovinos", "suinos", "aves", "equinos", "outros"]).notNull(),
    animalQuantity: int("animalQuantity").default(0),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 2 }),
    zipCode: varchar("zipCode", { length: 10 }),
    notes: text("notes"),
    status: mysqlEnum("status", ["ativo", "inativo", "prospect"]).default("prospect").notNull(),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    createdByIdx: index("createdByIdx").on(table.createdBy),
    statusIdx: index("statusIdx").on(table.status),
    animalTypeIdx: index("animalTypeIdx").on(table.animalType),
    clientTypeIdx: index("clientTypeIdx").on(table.clientType),
  })
);

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/**
 * Produtos de Nutrição Animal
 */
export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    stock: int("stock").default(0),
    unit: varchar("unit", { length: 50 }).default("kg"),
    active: boolean("active").default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("categoryIdx").on(table.category),
    activeIdx: index("activeIdx").on(table.active),
  })
);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Oportunidades de Vendas (Funil Kanban)
 */
export const opportunities = mysqlTable(
  "opportunities",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    stage: mysqlEnum("stage", [
      "prospeccao",
      "visita_tecnica",
      "orcamento_enviado",
      "negociacao",
      "venda_concluida",
      "perdida",
    ])
      .default("prospeccao")
      .notNull(),
    value: decimal("value", { precision: 12, scale: 2 }),
    probability: int("probability").default(0), // 0-100
    expectedCloseDate: datetime("expectedCloseDate"),
    closedDate: datetime("closedDate"),
    assignedTo: int("assignedTo").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    clientIdIdx: index("clientIdIdx").on(table.clientId),
    stageIdx: index("stageIdx").on(table.stage),
    assignedToIdx: index("assignedToIdx").on(table.assignedTo),
  })
);

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

/**
 * Orçamentos
 */
export const quotes = mysqlTable(
  "quotes",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId"),
    clientId: int("clientId").notNull(),
    quoteNumber: varchar("quoteNumber", { length: 50 }).notNull().unique(),
    status: mysqlEnum("status", ["rascunho", "enviado", "aceito", "rejeitado", "expirado"]).default("rascunho").notNull(),
    totalValue: decimal("totalValue", { precision: 12, scale: 2 }).default("0"),
    discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
    finalValue: decimal("finalValue", { precision: 12, scale: 2 }).default("0"),
    validityDays: int("validityDays").default(30),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    sentAt: datetime("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    clientIdIdx: index("clientIdIdx").on(table.clientId),
    opportunityIdIdx: index("opportunityIdIdx").on(table.opportunityId),
    statusIdx: index("statusIdx").on(table.status),
  })
);

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

/**
 * Itens de Orçamento
 */
export const quoteItems = mysqlTable(
  "quoteItems",
  {
    id: int("id").autoincrement().primaryKey(),
    quoteId: int("quoteId").notNull(),
    productId: int("productId").notNull(),
    quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    quoteIdIdx: index("quoteIdIdx").on(table.quoteId),
    productIdIdx: index("productIdIdx").on(table.productId),
  })
);

export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;

/**
 * Interações com Clientes (Visitas, Ligações, E-mails, Notas)
 */
export const interactions = mysqlTable(
  "interactions",
  {
    id: int("id").autoincrement().primaryKey(),
    clientId: int("clientId").notNull(),
    opportunityId: int("opportunityId"),
    type: mysqlEnum("type", ["visita", "ligacao", "email", "nota", "reuniao"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    date: datetime("date").notNull(),
    duration: int("duration"), // em minutos
    result: text("result") as any,
    nextAction: text("nextAction") as any,
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    clientIdIdx: index("clientIdIdx").on(table.clientId),
    opportunityIdIdx: index("opportunityIdIdx").on(table.opportunityId),
    typeIdx: index("typeIdx").on(table.type),
    dateIdx: index("dateIdx").on(table.date),
  })
);

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

/**
 * Vendas Concluídas
 */
export const sales = mysqlTable(
  "sales",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityId: int("opportunityId"),
    clientId: int("clientId").notNull(),
    quoteId: int("quoteId"),
    saleNumber: varchar("saleNumber", { length: 50 }).notNull().unique(),
    totalValue: decimal("totalValue", { precision: 12, scale: 2 }).notNull(),
    paymentStatus: mysqlEnum("paymentStatus", ["pendente", "parcial", "pago"]).default("pendente").notNull(),
    saleDate: datetime("saleDate").notNull(),
    deliveryDate: datetime("deliveryDate"),
    notes: text("notes"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    clientIdIdx: index("clientIdIdx").on(table.clientId),
    opportunityIdIdx: index("opportunityIdIdx").on(table.opportunityId),
    paymentStatusIdx: index("paymentStatusIdx").on(table.paymentStatus),
  })
);

export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;
