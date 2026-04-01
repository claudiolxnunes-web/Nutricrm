import { eq, and, like, desc, asc, gte, lte, inArray, sql, or, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  InsertUser,
  users,
  clients,
  products,
  opportunities,
  quotes,
  quoteItems,
  interactions,
  sales,
  monthlyGoals,
  companies,
  type Client,
  type Product,
  type Opportunity,
  type Quote,
  type QuoteItem,
  type Interaction,
  type Sale,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function createCompany(data: { name: string; email?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [company] = await db.insert(companies).values({
    name: data.name,
    email: data.email,
  }).returning();
  return company;
}

export async function listCompanies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companies).orderBy(companies.createdAt);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

export async function createUserWithPassword(data: { name: string; email: string; passwordHash: string; companyId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    lastSignedIn: new Date(),
    trialEndsAt,
    companyId: data.companyId ?? 1,
  }).returning();
  return result[0];
}

export async function listUsers(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    companyId: users.companyId,
    trialEndsAt: users.trialEndsAt,
    paidUntil: users.paidUntil,
    createdAt: users.createdAt,
  }).from(users);
  if (companyId) {
    return query.where(eq(users.companyId, companyId)).orderBy(users.createdAt);
  }
  return query.orderBy(users.createdAt);
}

export async function updateUserRole(id: number, role: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

export async function assignClientsToUser(clientIds: number[], userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set({ assignedTo: userId, updatedAt: new Date() })
    .where(inArray(clients.id, clientIds));
  return { assigned: clientIds.length };
}

export async function getClientCountByUser() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    assignedTo: clients.assignedTo,
    count: sql<number>`count(*)::int`,
  }).from(clients).where(isNotNull(clients.assignedTo)).groupBy(clients.assignedTo);
}

export async function activateUser(userId: number, days: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const paidUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.update(users).set({ paidUntil, updatedAt: new Date() }).where(eq(users.id, userId));
  return { paidUntil };
}

export function getUserAccessStatus(user: { trialEndsAt?: Date | null; paidUntil?: Date | null }) {
  const now = new Date();
  if (user.paidUntil && user.paidUntil > now) {
    return { active: true, reason: "paid", paidUntil: user.paidUntil, daysLeft: null };
  }
  if (user.trialEndsAt && user.trialEndsAt > now) {
    const daysLeft = Math.ceil((user.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return { active: true, reason: "trial", trialEndsAt: user.trialEndsAt, daysLeft };
  }
  return { active: false, reason: "expired", trialEndsAt: user.trialEndsAt, daysLeft: 0 };
}

// ========== CLIENTS ==========

export async function createClient(data: {
  clientType?: "fazenda" | "revendedor" | "distribuidor" | "agroindustria" | "fabrica_racoes";
  farmName: string;
  producerName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  animalType: "bovinos" | "suinos" | "aves" | "equinos" | "outros";
  animalQuantity?: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  createdBy: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(clients).values({ ...data, assignedTo: data.createdBy, companyId: data.companyId ?? 1 });
  return result;
}

export async function getClients(filters?: {
  search?: string;
  animalType?: string;
  status?: string;
  limit?: number;
  offset?: number;
  userId?: number;
  role?: string;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query: any = db.select().from(clients);

  const conditions = [];

  if (filters?.search) {
    conditions.push(
      sql`(${clients.farmName} LIKE ${`%${filters.search}%`} OR ${clients.producerName} LIKE ${`%${filters.search}%`})`
    );
  }

  if (filters?.animalType) {
    conditions.push(eq(clients.animalType, filters.animalType as any));
  }

  if (filters?.status) {
    conditions.push(eq(clients.status, filters.status as any));
  }

  if (filters?.role === "vendedor" && filters?.userId) {
    conditions.push(
      or(
        eq(clients.assignedTo, filters.userId),
        eq(clients.createdBy, filters.userId)
      )
    );
  }

  if (filters?.companyId) {
    conditions.push(eq(clients.companyId, filters.companyId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(clients.createdAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateClient(id: number, data: Partial<Client>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(clients).set(data).where(eq(clients.id, id));
}

// ========== PRODUCTS ==========

export async function createProduct(data: {
  name: string;
  category: string;
  description?: string;
  price: string;
  stock?: number;
  unit?: string;
  active?: boolean;
  companyId?: number;
  productCode?: string;
  packaging?: string;
  bagWeight?: string;
  species?: string;
  phase?: string;
  indication?: string;
  usageMode?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(products).values({ ...data, companyId: data.companyId ?? 1 });
}

export async function importProducts(rows: any[], companyId: number, createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.name) { skipped++; continue; }
    // Check duplicate by productCode or name within company
    const existing = await db.select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          row.productCode
            ? eq(products.productCode, row.productCode)
            : eq(products.name, row.name)
        )
      )
      .limit(1);
    if (existing.length > 0) { skipped++; continue; }
    await db.insert(products).values({
      companyId,
      name: row.name,
      category: row.category || "Racao",
      description: row.description || "",
      price: row.price || "0",
      stock: row.stock || 0,
      unit: row.unit || "kg",
      active: true,
      productCode: row.productCode || null,
      packaging: row.packaging || "saco",
      bagWeight: row.bagWeight || null,
      species: row.species || null,
      phase: row.phase || null,
      indication: row.indication || null,
      usageMode: row.usageMode || null,
    });
    imported++;
  }
  return { imported, skipped };
}

export async function getProducts(filters?: {
  search?: string;
  category?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query: any = db.select().from(products);

  const conditions = [];

  if (filters?.search) {
    conditions.push(like(products.name, `%${filters.search}%`));
  }

  if (filters?.category) {
    conditions.push(eq(products.category, filters.category));
  }

  if (filters?.active !== undefined) {
    conditions.push(eq(products.active, filters.active as any));
  }

  if (filters?.companyId) {
    conditions.push(eq(products.companyId, filters.companyId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(asc(products.name));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateProduct(id: number, data: Partial<Product>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(products).set(data).where(eq(products.id, id));
}

// ========== OPPORTUNITIES ==========

export async function createOpportunity(data: {
  clientId: number;
  title: string;
  description?: string;
  stage?: "prospeccao" | "visita_tecnica" | "orcamento_enviado" | "negociacao" | "venda_concluida" | "perdida";
  value?: string;
  probability?: number;
  expectedCloseDate?: Date;
  assignedTo: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(opportunities).values({ ...data, companyId: data.companyId ?? 1 });
}

export async function getOpportunities(filters?: {
  clientId?: number;
  stage?: string;
  assignedTo?: number;
  limit?: number;
  offset?: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query: any = db.select().from(opportunities);

  const conditions = [];

  if (filters?.clientId) {
    conditions.push(eq(opportunities.clientId, filters.clientId));
  }

  if (filters?.stage) {
    conditions.push(eq(opportunities.stage, filters.stage as any));
  }

  if (filters?.assignedTo) {
    conditions.push(eq(opportunities.assignedTo, filters.assignedTo));
  }

  if (filters?.companyId) {
    conditions.push(eq(opportunities.companyId, filters.companyId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(opportunities.updatedAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

export async function getOpportunityById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateOpportunity(id: number, data: Partial<Opportunity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(opportunities).set(data).where(eq(opportunities.id, id));
}



export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(clients).where(eq(clients.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(products).where(eq(products.id, id));
}

export async function deleteOpportunity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(opportunities).where(eq(opportunities.id, id));
}

// ========== QUOTES ==========

export async function createQuote(data: {
  opportunityId?: number;
  clientId: number;
  quoteNumber: string;
  status?: "rascunho" | "enviado" | "aceito" | "rejeitado" | "expirado";
  validityDays?: number;
  notes?: string;
  createdBy: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(quotes).values({ ...data, companyId: data.companyId ?? 1 });
}

export async function getQuotes(filters?: {
  clientId?: number;
  status?: string;
  limit?: number;
  offset?: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query: any = db.select().from(quotes);

  const conditions = [];

  if (filters?.clientId) {
    conditions.push(eq(quotes.clientId, filters.clientId));
  }

  if (filters?.status) {
    conditions.push(eq(quotes.status, filters.status as any));
  }

  if (filters?.companyId) {
    conditions.push(eq(quotes.companyId, filters.companyId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(quotes.createdAt));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

export async function getQuoteById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateQuote(id: number, data: Partial<Quote>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.update(quotes).set(data).where(eq(quotes.id, id));
}

// ========== QUOTE ITEMS ==========

export async function createQuoteItem(data: {
  quoteId: number;
  productId: number;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(quoteItems).values(data);
}

export async function getQuoteItems(quoteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
}

export async function deleteQuoteItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.delete(quoteItems).where(eq(quoteItems.id, id));
}

// ========== INTERACTIONS ==========

export async function createInteraction(data: {
  clientId: number;
  opportunityId?: number;
  type: "visita" | "ligacao" | "email" | "nota" | "reuniao";
  title: string;
  description?: string;
  date: Date;
  duration?: number;
  result?: string;
  nextAction?: string;
  createdBy: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(interactions).values({ ...data, companyId: data.companyId ?? 1 });
}

export async function getInteractions(filters?: {
  clientId?: number;
  opportunityId?: number;
  type?: string;
  limit?: number;
  offset?: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query: any = db.select().from(interactions);

  const conditions = [];

  if (filters?.clientId) {
    conditions.push(eq(interactions.clientId, filters.clientId));
  }

  if (filters?.opportunityId) {
    conditions.push(eq(interactions.opportunityId, filters.opportunityId));
  }

  if (filters?.type) {
    conditions.push(eq(interactions.type, filters.type as any));
  }

  if (filters?.companyId) {
    conditions.push(eq(interactions.companyId, filters.companyId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(interactions.date));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

// ========== SALES ==========

export async function createSale(data: {
  opportunityId?: number;
  clientId: number;
  quoteId?: number;
  saleNumber: string;
  totalValue: string;
  saleDate: Date;
  deliveryDate?: Date;
  notes?: string;
  createdBy: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(sales).values({ ...data, companyId: data.companyId ?? 1 });
}

export async function getSales(filters?: {
  clientId?: number;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query: any = db.select().from(sales);

  const conditions = [];

  if (filters?.clientId) {
    conditions.push(eq(sales.clientId, filters.clientId));
  }

  if (filters?.paymentStatus) {
    conditions.push(eq(sales.paymentStatus, filters.paymentStatus as any));
  }

  if (filters?.startDate) {
    conditions.push(gte(sales.saleDate, filters.startDate));
  }

  if (filters?.endDate) {
    conditions.push(lte(sales.saleDate, filters.endDate));
  }

  if (filters?.companyId) {
    conditions.push(eq(sales.companyId, filters.companyId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  query = query.orderBy(desc(sales.saleDate));

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.offset(filters.offset);
  }

  return query;
}

// ========== DASHBOARD METRICS ==========

export async function getDashboardMetrics(userId: number, companyId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Total sales value
  const totalSalesResult = await db
    .select({
      total: sql<string>`SUM(${sales.totalValue})`,
    })
    .from(sales)
    .where(companyId ? eq(sales.companyId, companyId) : undefined)
    ;

  // Total opportunities
  const totalOpportunitiesResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(opportunities)
    .where(companyId ? eq(opportunities.companyId, companyId) : undefined)
    ;

  // Opportunities by stage
  const opportunitiesByStage = await db
    .select({
      stage: opportunities.stage,
      count: sql<number>`COUNT(*)`,
    })
    .from(opportunities)
    .where(companyId ? eq(opportunities.companyId, companyId) : undefined)
    .groupBy(opportunities.stage);

  // Total clients
  const totalClientsResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(clients)
    .where(companyId ? eq(clients.companyId, companyId) : undefined)
    ;

  return {
    totalSales: totalSalesResult[0]?.total || "0",
    totalOpportunities: totalOpportunitiesResult[0]?.count || 0,
    totalClients: totalClientsResult[0]?.count || 0,
    opportunitiesByStage,
  };
}
// ========== AI FORECAST DATA ==========
export async function getAiForecastData(companyId?: number) {
  const db = await getDb();
  if (!db) return { opportunities: [], products: [], clients: [], sales: [] };
  const opps = await db.select().from(opportunities)
    .where(companyId ? eq(opportunities.companyId, companyId) : undefined)
    .orderBy(desc(opportunities.createdAt));
  const prods = await db.select().from(products)
    .where(companyId ? eq(products.companyId, companyId) : undefined);
  const clientList = await db.select().from(clients)
    .where(companyId ? eq(clients.companyId, companyId) : undefined);
  const salesList = await db.select().from(sales)
    .where(companyId ? eq(sales.companyId, companyId) : undefined)
    .orderBy(desc(sales.createdAt));
  return { opportunities: opps, products: prods, clients: clientList, sales: salesList };
}

// ========== CLIENT SCORE ==========
export async function updateClientScore(id: number, score: number) {
  const db = await getDb();
  if (!db) return;
  return db.update(clients).set({ score, updatedAt: new Date() }).where(eq(clients.id, id));
}

export async function updateClientGeo(id: number, lat: string, lng: string) {
  const db = await getDb();
  if (!db) return;
  return db.update(clients).set({ lat, lng, updatedAt: new Date() } as any).where(eq(clients.id, id));
}

export async function getVisits(filters?: { clientId?: number; companyId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(interactions.type, "visita")];
  if (filters?.clientId) conditions.push(eq(interactions.clientId, filters.clientId));
  if (filters?.companyId) conditions.push(eq(interactions.companyId, filters.companyId));
  return db.select().from(interactions)
    .where(and(...conditions))
    .orderBy(desc(interactions.date))
    .limit(filters?.limit ?? 50);
}


// ========== MONTHLY GOALS ==========
export async function setMonthlyGoal(companyId: number, month: string, goalValue: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(monthlyGoals)
    .where(and(eq(monthlyGoals.companyId, companyId), eq(monthlyGoals.month, month)))
    .limit(1);
  if (existing.length > 0) {
    return db.update(monthlyGoals).set({ goalValue }).where(and(eq(monthlyGoals.companyId, companyId), eq(monthlyGoals.month, month)));
  }
  return db.insert(monthlyGoals).values({ companyId, month, goalValue });
}

export async function getMonthlyGoal(companyId: number, month: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(monthlyGoals)
    .where(and(eq(monthlyGoals.companyId, companyId), eq(monthlyGoals.month, month)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getMonthlyProgress(companyId: number, month: string) {
  const db = await getDb();
  if (!db) return { realized: 0, pipeline: 0 };
  const [year, m] = month.split("-").map(Number);
  const startDate = new Date(year, m - 1, 1);
  const endDate = new Date(year, m, 0, 23, 59, 59);
  const salesRows = await db.select().from(sales)
    .where(and(eq(sales.companyId, companyId), gte(sales.createdAt, startDate), lte(sales.createdAt, endDate)));
  const realized = salesRows.reduce((s, r) => s + parseFloat(r.totalValue ?? "0"), 0);
  const oppsRows = await db.select().from(opportunities)
    .where(and(eq(opportunities.companyId, companyId), sql`stage != 'perdida'`));
  const pipeline = oppsRows.reduce((s, o) => {
    const prob = (o.probability ?? 0) > 0 ? o.probability! : 10;
    return s + parseFloat(o.value ?? "0") * (prob / 100);
  }, 0);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(year, m, 0).getDate();
  const projection = dayOfMonth > 0 ? (realized / dayOfMonth) * daysInMonth : 0;
  return { realized, pipeline, projection };
}

export async function getABCData(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  const salesRows = await db.select().from(sales).where(eq(sales.companyId, companyId));
  const clientsRows = await db.select().from(clients).where(eq(clients.companyId, companyId));
  const clientMap: Record<number, string> = {};
  clientsRows.forEach(c => { clientMap[c.id] = c.farmName || c.producerName || `#${c.id}`; });
  const byClient: Record<number, number> = {};
  salesRows.forEach(s => {
    if (!s.clientId) return;
    byClient[s.clientId] = (byClient[s.clientId] ?? 0) + parseFloat(s.totalValue ?? "0");
  });
  const total = Object.values(byClient).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(byClient)
    .map(([id, value]) => ({ clientId: Number(id), name: clientMap[Number(id)] ?? `#${id}`, value }))
    .sort((a, b) => b.value - a.value);
  let accumulated = 0;
  return sorted.map((row, i) => {
    accumulated += row.value;
    const pct = total > 0 ? (row.value / total) * 100 : 0;
    const accPct = total > 0 ? (accumulated / total) * 100 : 0;
    const cls = accPct <= 80 ? "A" : accPct <= 95 ? "B" : "C";
    return { ...row, rank: i + 1, pct, accPct, cls };
  });
}

// ========== PLAN HELPERS ==========
export async function countUsersByCompany(companyId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.companyId, companyId));
  return result[0]?.count ?? 0;
}

export async function getCompanyPlan(companyId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ plan: companies.plan }).from(companies).where(eq(companies.id, companyId)).limit(1);
  return result[0]?.plan ?? "individual";
}

export async function setCompanyPlan(companyId: number, plan: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companies).set({ plan } as any).where(eq(companies.id, companyId));
}
// ========== INTERACTIONS GLOBAL ==========
export async function getAllInteractions(companyId: number, filters?: { type?: string; visitResult?: string; fromDate?: Date; toDate?: Date; limit?: number; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [eq(interactions.companyId, companyId)];
  if (filters?.type) conditions.push(eq(interactions.type, filters.type));
  if (filters?.visitResult) conditions.push(eq(interactions.visitResult as any, filters.visitResult));
  if (filters?.fromDate) conditions.push(gte(interactions.date, filters.fromDate));
  if (filters?.toDate) conditions.push(lte(interactions.date, filters.toDate));
  const rows = await db
    .select({
      id: interactions.id, clientId: interactions.clientId,
      clientName: sql<string>`COALESCE(${clients.farmName}, ${clients.producerName}, '#' || ${clients.id}::text)`,
      opportunityId: interactions.opportunityId, type: interactions.type, title: interactions.title,
      description: interactions.description, date: interactions.date, duration: interactions.duration,
      result: interactions.result, nextAction: interactions.nextAction,
      nextVisitDate: interactions.nextVisitDate, visitResult: interactions.visitResult,
      createdBy: interactions.createdBy, createdAt: interactions.createdAt,
    })
    .from(interactions).leftJoin(clients, eq(interactions.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(sql`CASE WHEN ${interactions.nextVisitDate} IS NULL THEN 1 ELSE 0 END`, interactions.nextVisitDate)
    .limit(filters?.limit ?? 200);
  return rows;
}

export async function getUpcomingVisits(companyId: number, fromDate: Date, toDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: interactions.id, clientId: interactions.clientId,
    clientName: sql<string>`COALESCE(${clients.farmName}, ${clients.producerName}, '#' || ${clients.id}::text)`,
    type: interactions.type, title: interactions.title,
    nextVisitDate: interactions.nextVisitDate, visitResult: interactions.visitResult,
    result: interactions.result, createdBy: interactions.createdBy,
  })
  .from(interactions).leftJoin(clients, eq(interactions.clientId, clients.id))
  .where(and(eq(interactions.companyId, companyId), gte(interactions.nextVisitDate as any, fromDate), lte(interactions.nextVisitDate as any, toDate)))
  .orderBy(interactions.nextVisitDate);
}

export async function scheduleNextVisit(interactionId: number, nextVisitDate: Date, visitResult: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(interactions).set({ nextVisitDate, visitResult } as any).where(eq(interactions.id, interactionId));
}