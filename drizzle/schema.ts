import {
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  index,
  serial,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: text("role").default("vendedor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  clientType: varchar("clientType", { length: 50 }).default("fazenda").notNull(),
  activityType: varchar("activityType", { length: 80 }),
  farmName: varchar("farmName", { length: 255 }).notNull(),
  producerName: varchar("producerName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  animalType: text("animalType").notNull(),
  animalQuantity: integer("animalQuantity").default(0),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  notes: text("notes"),
  status: text("status").default("prospect").notNull(),
  createdBy: integer("createdBy").notNull(),
  assignedTo: integer("assignedTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ cliCreatedByIdx: index("cliCreatedByIdx").on(t.createdBy), cliStatusIdx: index("cliStatusIdx").on(t.status) }));
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").default(0),
  unit: varchar("unit", { length: 50 }).default("kg"),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ prodCategoryIdx: index("prodCategoryIdx").on(t.category) }));
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  stage: text("stage").default("prospeccao").notNull(),
  value: decimal("value", { precision: 12, scale: 2 }),
  probability: integer("probability").default(0),
  expectedCloseDate: timestamp("expectedCloseDate"),
  closedDate: timestamp("closedDate"),
  assignedTo: integer("assignedTo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ oppClientIdIdx: index("oppClientIdIdx").on(t.clientId), oppStageIdx: index("oppStageIdx").on(t.stage) }));
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunityId"),
  clientId: integer("clientId").notNull(),
  quoteNumber: varchar("quoteNumber", { length: 50 }).notNull().unique(),
  status: text("status").default("rascunho").notNull(),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  finalValue: decimal("finalValue", { precision: 12, scale: 2 }).default("0"),
  validityDays: integer("validityDays").default(30),
  notes: text("notes"),
  createdBy: integer("createdBy").notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ qtClientIdIdx: index("qtClientIdIdx").on(t.clientId), qtStatusIdx: index("qtStatusIdx").on(t.status) }));
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

export const quoteItems = pgTable("quoteItems", {
  id: serial("id").primaryKey(),
  quoteId: integer("quoteId").notNull(),
  productId: integer("productId").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ qiQuoteIdIdx: index("qiQuoteIdIdx").on(t.quoteId) }));
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  clientId: integer("clientId").notNull(),
  opportunityId: integer("opportunityId"),
  type: text("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  duration: integer("duration"),
  result: text("result") as any,
  nextAction: text("nextAction") as any,
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ intClientIdIdx: index("intClientIdIdx").on(t.clientId), intTypeIdx: index("intTypeIdx").on(t.type) }));
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  opportunityId: integer("opportunityId"),
  clientId: integer("clientId").notNull(),
  quoteId: integer("quoteId"),
  saleNumber: varchar("saleNumber", { length: 50 }).notNull().unique(),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }).notNull(),
  paymentStatus: text("paymentStatus").default("pendente").notNull(),
  saleDate: timestamp("saleDate").notNull(),
  deliveryDate: timestamp("deliveryDate"),
  notes: text("notes"),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ salClientIdIdx: index("salClientIdIdx").on(t.clientId), salPaymentStatusIdx: index("salPaymentStatusIdx").on(t.paymentStatus) }));
export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;

