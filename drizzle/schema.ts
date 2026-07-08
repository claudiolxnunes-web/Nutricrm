import {
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  index,
  serial,
  jsonb,  // ADICIONAR
  numeric, // ADICIONAR
} from "drizzle-orm/pg-core";
export const orcamentosSimples = pgTable("orcamentos_simples", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  companyId: integer("company_id").notNull(),
  clienteNome: text("cliente_nome").notNull(),
  clienteEmail: text("cliente_email"),
  produtos: jsonb("produtos").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("rascunho"),
  criadoEm: timestamp("criado_em").defaultNow().notNull(),
});

export type OrcamentoSimples = typeof orcamentosSimples.$inferSelect;
export type InsertOrcamentoSimples = typeof orcamentosSimples.$inferInsert;
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  active: boolean("active").default(true).notNull(),
  plan: varchar("plan", { length: 20 }).default("individual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: text("role").default("vendedor").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  paidUntil: timestamp("paidUntil"),
  resetPasswordToken: text("resetPasswordToken"),
  resetPasswordExpiresAt: timestamp("resetPasswordExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  externalCode: varchar("externalCode", { length: 100 }),
  clientType: varchar("clientType", { length: 50 }).default("fazenda").notNull(),
  activityType: varchar("activityType", { length: 80 }),
  farmName: varchar("farmName", { length: 255 }).notNull(),
  producerName: varchar("producerName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  whatsapp: varchar("whatsapp", { length: 20 }),
  animalType: text("animalType").notNull(),
  animalQuantity: integer("animalQuantity").default(0),
  herdProfile: varchar("herdProfile", { length: 40 }),
  productionSystem: varchar("productionSystem", { length: 40 }),
  dailyMilkProduction: integer("dailyMilkProduction"),
  monthlyFeedConsumptionKg: integer("monthlyFeedConsumptionKg"),
  pastureAreaHa: decimal("pastureAreaHa", { precision: 10, scale: 2 }),
  confinementCapacity: integer("confinementCapacity"),
  nutritionChallenges: text("nutritionChallenges"),
  lastPurchaseDate: timestamp("lastPurchaseDate"),
  purchaseFrequencyDays: integer("purchaseFrequencyDays"),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zipCode", { length: 10 }),
  notes: text("notes"),
  status: text("status").default("prospect").notNull(),
  score: integer("score").default(0),
  lat: decimal("lat", { precision: 10, scale: 6 }),
  lng: decimal("lng", { precision: 10, scale: 6 }),
  createdBy: integer("createdBy").notNull(),
  assignedTo: integer("assignedTo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  cliCreatedByIdx: index("cliCreatedByIdx").on(t.createdBy),
  cliStatusIdx: index("cliStatusIdx").on(t.status),
  cliCompanyExternalCodeIdx: index("cliCompanyExternalCodeIdx").on(t.companyId, t.externalCode),
}));
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  externalCode: varchar("externalCode", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").default(0),
  unit: varchar("unit", { length: 50 }).default("kg"),
  productCode: varchar("productCode", { length: 50 }),
  packaging: varchar("packaging", { length: 20 }).default("saco"),
  bagWeight: varchar("bagWeight", { length: 50 }),
  species: varchar("species", { length: 100 }),
  phase: varchar("phase", { length: 100 }),
  indication: varchar("indication", { length: 255 }),
  usageMode: varchar("usageMode", { length: 255 }),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  prodCategoryIdx: index("prodCategoryIdx").on(t.category),
  prodCompanyExternalCodeIdx: index("prodCompanyExternalCodeIdx").on(t.companyId, t.externalCode),
}));
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
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
  companyId: integer("companyId").notNull().default(1),
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ qtClientIdIdx: index("qtClientIdIdx").on(t.clientId), qtStatusIdx: index("qtStatusIdx").on(t.status) }));
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;

export const quoteItems = pgTable("quoteItems", {
  id: serial("id").primaryKey(),
  quoteId: integer("quoteId").notNull(),
  productId: integer("productId"),
  productName: varchar("productName", { length: 255 }),
  unit: varchar("unit", { length: 50 }).default("saco"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ qiQuoteIdIdx: index("qiQuoteIdIdx").on(t.quoteId) }));
export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = typeof quoteItems.$inferInsert;

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  clientId: integer("clientId").notNull(),
  opportunityId: integer("opportunityId"),
  type: text("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  duration: integer("duration"),
  result: text("result") as any,
  nextAction: text("nextAction") as any,
  nextVisitDate: timestamp("nextVisitDate"),
  visitResult: varchar("visitResult", { length: 50 }),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ intClientIdIdx: index("intClientIdIdx").on(t.clientId), intTypeIdx: index("intTypeIdx").on(t.type) }));
export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = typeof interactions.$inferInsert;

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  importKey: varchar("importKey", { length: 160 }),
  opportunityId: integer("opportunityId"),
  clientId: integer("clientId").notNull(),
  quoteId: integer("quoteId"),
  saleNumber: varchar("saleNumber", { length: 50 }).notNull().unique(),
  notaFiscal: varchar("notaFiscal", { length: 50 }),
  pedidoNumber: varchar("pedidoNumber", { length: 50 }),
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }).notNull(),
  discountValue: decimal("discountValue", { precision: 12, scale: 2 }).default("0"),
  discountPercent: decimal("discountPercent", { precision: 5, scale: 2 }).default("0"),
  bonusValue: decimal("bonusValue", { precision: 12, scale: 2 }).default("0"),
  bonusQuantity: integer("bonusQuantity").default(0),
  finalValue: decimal("finalValue", { precision: 12, scale: 2 }).notNull(),
  // Campos de métricas financeiras
  volumeSacos: decimal("volumeSacos", { precision: 12, scale: 2 }).default("0"),
  volumeKg: decimal("volumeKg", { precision: 12, scale: 2 }).default("0"),
  precoPorKg: decimal("precoPorKg", { precision: 10, scale: 2 }).default("0"),
  custoTotal: decimal("custoTotal", { precision: 12, scale: 2 }).default("0"),
  despesaComercial: decimal("despesaComercial", { precision: 12, scale: 2 }).default("0"),
  frete: decimal("frete", { precision: 12, scale: 2 }).default("0"),
  // Margens
  margemBrutaPercent: decimal("margemBrutaPercent", { precision: 5, scale: 2 }).default("0"),
  margemBrutaValor: decimal("margemBrutaValor", { precision: 12, scale: 2 }).default("0"),
  margemLiquidaPercent: decimal("margemLiquidaPercent", { precision: 5, scale: 2 }).default("0"),
  margemLiquidaValor: decimal("margemLiquidaValor", { precision: 12, scale: 2 }).default("0"),
  // Comissões
  comissaoPercent: decimal("comissaoPercent", { precision: 5, scale: 2 }).default("0"),
  comissaoValor: decimal("comissaoValor", { precision: 12, scale: 2 }).default("0"),
  // Impostos
  icms: decimal("icms", { precision: 12, scale: 2 }).default("0"),
  pis: decimal("pis", { precision: 12, scale: 2 }).default("0"),
  cofins: decimal("cofins", { precision: 12, scale: 2 }).default("0"),
  // Classificação
  grupoProduto: text("grupoProduto"),
  solucao: text("solucao"),
  subsolucao: text("subsolucao"),
  linha: text("linha"),
  grv: text("grv"),
  gnv: text("gnv"),
  filial: text("filial"),
  codigoCFOP: text("codigoCFOP"),
  mesAno: text("mesAno"),
  ano: integer("ano"),
  // Status
  paymentStatus: text("paymentStatus").default("pendente").notNull(),
  saleDate: timestamp("saleDate").notNull(),
  deliveryDate: timestamp("deliveryDate"),
  notes: text("notes"),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({ 
  salClientIdIdx: index("salClientIdIdx").on(t.clientId), 
  salPaymentStatusIdx: index("salPaymentStatusIdx").on(t.paymentStatus),
  salNotaFiscalIdx: index("salNotaFiscalIdx").on(t.notaFiscal),
  salPedidoIdx: index("salPedidoIdx").on(t.pedidoNumber),
  salMesAnoIdx: index("salMesAnoIdx").on(t.mesAno),
  salAnoIdx: index("salAnoIdx").on(t.ano),
  salCompanyImportKeyIdx: index("salCompanyImportKeyIdx").on(t.companyId, t.importKey),
}));
export type Sale = typeof sales.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;
export const monthlyGoals = pgTable("monthly_goals", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  userId: integer("userId"),
  month: varchar("month", { length: 7 }).notNull(),
  goalValue: decimal("goalValue", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow(),
}, (t) => [index("monthly_goals_idx").on(t.companyId, t.month)]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  companyId: integer("company_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [index("push_subs_user_idx").on(t.userId), index("push_subs_company_idx").on(t.companyId)]);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Tabela para pedidos em carteira (separado de vendas faturadas)
export const pedidosCarteira = pgTable("pedidos_carteira", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull().default(1),
  importKey: varchar("importKey", { length: 160 }),
  clientId: integer("clientId").notNull(),
  pedidoNumber: varchar("pedidoNumber", { length: 50 }).notNull(),
  status: text("status").default("pendente").notNull(), // pendente, faturado, cancelado
  totalValue: decimal("totalValue", { precision: 12, scale: 2 }).notNull(),
  qtdeSacos: integer("qtdeSacos").default(0),
  precoSaco: decimal("precoSaco", { precision: 10, scale: 2 }),
  dataPedido: timestamp("dataPedido").notNull(),
  dataPrevFaturamento: timestamp("dataPrevFaturamento"),
  representante: text("representante"),
  notaFiscal: varchar("notaFiscal", { length: 50 }),
  observacoes: text("observacoes"),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => [
  index("pedcart_client_idx").on(t.clientId),
  index("pedcart_status_idx").on(t.status),
  index("pedcart_pedido_idx").on(t.pedidoNumber),
  index("pedcart_company_import_key_idx").on(t.companyId, t.importKey),
]);

export type PedidoCarteira = typeof pedidosCarteira.$inferSelect;
export type InsertPedidoCarteira = typeof pedidosCarteira.$inferInsert;


