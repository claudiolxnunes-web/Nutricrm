import { eq, and, like, desc, asc, gte, lte, inArray, sql, or, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { orcamentosSimples } from "../drizzle/schema";
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
  pushSubscriptions,
  pedidosCarteira,
  type Client,
  type Product,
  type Opportunity,
  type Quote,
  type QuoteItem,
  type Interaction,
  type Sale,
  type PedidoCarteira,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbInitialized = false;

export async function getDb() {
  if (_dbInitialized) return _db;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[Database] DATABASE_URL is not defined in environment variables");
    _dbInitialized = true;
    return null;
  }

  console.log("[Database] Initializing connection pool...");
  console.log("[Database] DATABASE_URL starts with:", dbUrl.substring(0, 30) + "...");

  try {
    const isLocalhost = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    });

    // Test the connection before accepting it as valid
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      console.log("[Database] Connection test passed - database is reachable");
    } catch (connErr: any) {
      console.error("[Database] Connection test FAILED:", connErr.message);
      console.error("[Database] Error code:", connErr.code);
      console.error("[Database] Full error:", JSON.stringify(connErr, null, 2));
      await pool.end().catch(() => {});
      _dbInitialized = true;
      _db = null;
      return null;
    }

    _db = drizzle(pool);
    _dbInitialized = true;
    console.log("[Database] Pool initialized successfully");
  } catch (error: any) {
    console.error("[Database] Failed to create pool:", error.message);
    console.error("[Database] Full error:", JSON.stringify(error, null, 2));
    _dbInitialized = true;
    _db = null;
  }

  return _db;
}

// Allow resetting the connection (e.g., after a transient failure)
export function resetDb() {
  _db = null;
  _dbInitialized = false;
  console.log("[Database] Connection reset requested");
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

export async function updateUserPasswordHash(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function updateUserOpenId(id: number, openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ openId, updatedAt: new Date() }).where(eq(users.id, id));
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
  herdProfile?: "leite" | "corte" | "misto";
  productionSystem?: "confinamento" | "semi_confinamento" | "pasto" | "compost_barn" | "free_stall";
  dailyMilkProduction?: number;
  monthlyFeedConsumptionKg?: number;
  pastureAreaHa?: string;
  confinementCapacity?: number;
  nutritionChallenges?: string;
  lastPurchaseDate?: Date;
  purchaseFrequencyDays?: number;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  notes?: string;
  score?: number;
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
      sql`(${clients.farmName} ILIKE ${`%${filters.search}%`} OR ${clients.producerName} ILIKE ${`%${filters.search}%`} OR ${clients.notes} ILIKE ${`%${filters.search}%`})`
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

export async function getClientNutritionSummary(clientId: number, companyId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const clientConditions = [eq(clients.id, clientId)];
  if (companyId) clientConditions.push(eq(clients.companyId, companyId));

  const clientRows = await db.select().from(clients).where(and(...clientConditions)).limit(1);
  const client = clientRows[0];
  if (!client) return null;

  const salesConditions = [eq(sales.clientId, clientId)];
  const interactionsConditions = [eq(interactions.clientId, clientId)];
  if (companyId) {
    salesConditions.push(eq(sales.companyId, companyId));
    interactionsConditions.push(eq(interactions.companyId, companyId));
  }

  const [salesRows, interactionsRows] = await Promise.all([
    db.select({
      finalValue: sales.finalValue,
      volumeKg: sales.volumeKg,
      createdAt: sales.createdAt,
    }).from(sales).where(and(...salesConditions)).orderBy(desc(sales.createdAt)).limit(12),
    db.select({
      type: interactions.type,
      date: interactions.date,
      nextVisitDate: interactions.nextVisitDate,
    }).from(interactions).where(and(...interactionsConditions)).orderBy(desc(interactions.date)).limit(20),
  ]);

  const totalRevenue = salesRows.reduce((sum, row) => sum + Number(row.finalValue ?? 0), 0);
  const totalVolumeKg = salesRows.reduce((sum, row) => sum + Number(row.volumeKg ?? 0), 0);
  const averageTicket = salesRows.length ? totalRevenue / salesRows.length : 0;
  const averageMonthlyVolumeKg = salesRows.length ? totalVolumeKg / Math.min(salesRows.length, 12) : 0;
  const lastSaleDate = salesRows[0]?.createdAt ?? client.lastPurchaseDate ?? null;
  const daysSinceLastPurchase = lastSaleDate
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / 86400000))
    : null;
  const expectedRepurchaseInDays = client.purchaseFrequencyDays ?? null;
  const repurchaseStatus =
    daysSinceLastPurchase === null || expectedRepurchaseInDays === null
      ? "sem_historico"
      : daysSinceLastPurchase > expectedRepurchaseInDays
        ? "atrasado"
        : daysSinceLastPurchase >= Math.max(expectedRepurchaseInDays - 7, 0)
          ? "proximo"
          : "em_dia";
  const technicalVisitsLast90Days = interactionsRows.filter((row) => {
    if (row.type !== "visita") return false;
    return Date.now() - new Date(row.date).getTime() <= 90 * 86400000;
  }).length;
  const nextVisitDate = interactionsRows.find((row) => row.nextVisitDate && new Date(row.nextVisitDate) >= new Date())?.nextVisitDate ?? null;

  const estimatedMonthlyPotentialValue = (() => {
    const monthlyFeedConsumptionKg = client.monthlyFeedConsumptionKg ?? 0;
    if (!monthlyFeedConsumptionKg || !averageMonthlyVolumeKg || !totalRevenue) return null;
    const averagePricePerKg = totalVolumeKg > 0 ? totalRevenue / totalVolumeKg : 0;
    if (!averagePricePerKg) return null;
    return monthlyFeedConsumptionKg * averagePricePerKg;
  })();

  return {
    herdProfile: client.herdProfile,
    productionSystem: client.productionSystem,
    dailyMilkProduction: client.dailyMilkProduction,
    monthlyFeedConsumptionKg: client.monthlyFeedConsumptionKg,
    pastureAreaHa: client.pastureAreaHa,
    confinementCapacity: client.confinementCapacity,
    nutritionChallenges: client.nutritionChallenges,
    averageTicket,
    averageMonthlyVolumeKg,
    totalRevenue,
    totalVolumeKg,
    lastSaleDate,
    daysSinceLastPurchase,
    expectedRepurchaseInDays,
    repurchaseStatus,
    technicalVisitsLast90Days,
    nextVisitDate,
    estimatedMonthlyPotentialValue,
  };
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

export async function getQuotes(filters?: {
  companyId?: number;
  clientId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  // Query simples sem joins
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const conditions: any[] = [];
  
  if (filters?.companyId) conditions.push(eq(quotes.companyId, filters.companyId));
  if (filters?.clientId) conditions.push(eq(quotes.clientId, filters.clientId));
  if (filters?.status) conditions.push(eq(quotes.status, filters.status));
  
  const quoteList = await db
    .select({
      id: quotes.id,
      companyId: quotes.companyId,
      clientId: quotes.clientId,
      quoteNumber: quotes.quoteNumber,
      status: quotes.status,
      totalValue: quotes.totalValue,
      discount: quotes.discount,
      finalValue: quotes.finalValue,
      validityDays: quotes.validityDays,
      notes: quotes.notes,
      createdBy: quotes.createdBy,
      createdAt: quotes.createdAt,
      updatedAt: quotes.updatedAt,
    })
    .from(quotes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(quotes.createdAt))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);

  // Busca itens apenas se houver orçamentos
  if (quoteList.length === 0) return quoteList;

  // Busca itens em lotes pequenos para economizar memória
  const quoteIds = quoteList.map(q => q.id);
  const allItems = await db
    .select({
      id: quoteItems.id,
      quoteId: quoteItems.quoteId,
      productId: quoteItems.productId,
      productName: quoteItems.productName,
      quantity: quoteItems.quantity,
      unitPrice: quoteItems.unitPrice,
      totalPrice: quoteItems.totalPrice,
      unit: quoteItems.unit,
    })
    .from(quoteItems)
    .where(inArray(quoteItems.quoteId, quoteIds.slice(0, 100))); // limite de 100 orçamentos

  // Junta os dados
  return quoteList.map(q => ({
    ...q,
    items: allItems.filter(item => item.quoteId === q.id),
    itemCount: allItems.filter(item => item.quoteId === q.id).length,
  }));
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

export async function updateQuoteStatus(id: number, status: "rascunho" | "enviado" | "aceito" | "rejeitado" | "expirado") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(quotes).set({ status, updatedAt: new Date() }).where(eq(quotes.id, id));
}

export async function deleteQuote(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));
  return db.delete(quotes).where(eq(quotes.id, id));
}

export async function createQuoteWithItems(
  quoteData: {
    opportunityId?: number;
    clientId: number;
    quoteNumber: string;
    validityDays?: number;
    notes?: string;
    createdBy: number;
    companyId?: number;
  },
  items: Array<{
    productId?: number;
    productName?: string;
    quantity: string;
    unitPrice: string;
    totalPrice: string;
    unit?: string;
  }>,
  discountPct: number = 0,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const subtotal = items.reduce((s, it) => s + parseFloat(it.totalPrice || "0"), 0);
  const discountAmt = subtotal * (discountPct / 100);
  const finalValue = subtotal - discountAmt;

  const [quote] = await db
    .insert(quotes)
    .values({
      ...quoteData,
      companyId: quoteData.companyId ?? 1,
      totalValue: subtotal.toFixed(2),
      discount: discountAmt.toFixed(2),
      finalValue: finalValue.toFixed(2),
    })
    .returning();

  if (items.length > 0) {
    await db.insert(quoteItems).values(
      items.map((it) => ({
        quoteId: quote.id,
        productId: it.productId ?? null,
        productName: it.productName ?? null,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
        unit: it.unit ?? "un",
      })),
    );
  }

  return quote;
}

export async function getQuoteWithItems(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const quoteResult = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  const quote = quoteResult.length > 0 ? quoteResult[0] : null;
  if (!quote) return null;

  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id));
  return { ...quote, items };
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
  paymentStatus?: string;
  createdBy: number;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(sales).values({
    ...data,
    companyId: data.companyId ?? 1,
    finalValue: data.totalValue,
  });
}

export async function deleteSale(id: number, companyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sales).where(and(eq(sales.id, id), eq(sales.companyId, companyId)));
  return { success: true };
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

export async function getSalesCount(filters?: {
  clientId?: number;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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

  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(sales)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0]?.count ?? 0;
}

export async function getSalesSummary(filters?: {
  startDate?: Date;
  endDate?: Date;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (filters?.startDate) {
    conditions.push(gte(sales.saleDate, filters.startDate));
  }

  if (filters?.endDate) {
    conditions.push(lte(sales.saleDate, filters.endDate));
  }

  if (filters?.companyId) {
    conditions.push(eq(sales.companyId, filters.companyId));
  }

  const [summary] = await db
    .select({
      totalSales: sql<string>`COALESCE(SUM(${sales.totalValue}), 0)::text`,
      totalTransactions: sql<number>`COUNT(*)::int`,
      paidCount: sql<number>`COUNT(*) FILTER (WHERE ${sales.paymentStatus} = 'pago')::int`,
      pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${sales.paymentStatus} = 'pendente')::int`,
      partialCount: sql<number>`COUNT(*) FILTER (WHERE ${sales.paymentStatus} = 'parcial')::int`,
    })
    .from(sales)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const totalSales = parseFloat(summary?.totalSales ?? "0");
  const totalTransactions = summary?.totalTransactions ?? 0;

  return {
    totalSales,
    totalTransactions,
    averageSale: totalTransactions > 0 ? totalSales / totalTransactions : 0,
    paidCount: summary?.paidCount ?? 0,
    pendingCount: summary?.pendingCount ?? 0,
    partialCount: summary?.partialCount ?? 0,
  };
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

export async function getDashboardPeriodMetrics(filters?: {
  startDate?: Date;
  endDate?: Date;
  companyId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const salesConditions = [];
  if (filters?.companyId) salesConditions.push(eq(sales.companyId, filters.companyId));
  if (filters?.startDate) salesConditions.push(gte(sales.saleDate, filters.startDate));
  if (filters?.endDate) salesConditions.push(lte(sales.saleDate, filters.endDate));

  const quoteConditions = [];
  if (filters?.companyId) quoteConditions.push(eq(quotes.companyId, filters.companyId));

  const opportunityConditions = [];
  if (filters?.companyId) opportunityConditions.push(eq(opportunities.companyId, filters.companyId));

  const clientConditions = [];
  if (filters?.companyId) clientConditions.push(eq(clients.companyId, filters.companyId));

  const [salesSummary] = await db
    .select({
      totalSales: sql<string>`COALESCE(SUM(${sales.totalValue}), 0)::text`,
      salesCount: sql<number>`COUNT(*)::int`,
    })
    .from(sales)
    .where(salesConditions.length > 0 ? and(...salesConditions) : undefined);

  const staleQuotes = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      createdAt: quotes.createdAt,
    })
    .from(quotes)
    .where(and(
      quoteConditions.length > 0 ? and(...quoteConditions) : undefined,
      eq(quotes.status, "enviado"),
      sql`${quotes.createdAt} <= NOW() - INTERVAL '5 days'`,
    ));

  const stalledOpportunities = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      updatedAt: opportunities.updatedAt,
    })
    .from(opportunities)
    .where(and(
      opportunityConditions.length > 0 ? and(...opportunityConditions) : undefined,
      eq(opportunities.stage, "negociacao"),
      sql`${opportunities.updatedAt} <= NOW() - INTERVAL '15 days'`,
    ));

  const repurchaseCandidates = await db
    .select({
      id: clients.id,
      farmName: clients.farmName,
      producerName: clients.producerName,
      city: clients.city,
      lastPurchaseDate: clients.lastPurchaseDate,
      purchaseFrequencyDays: clients.purchaseFrequencyDays,
    })
    .from(clients)
    .where(and(
      clientConditions.length > 0 ? and(...clientConditions) : undefined,
      sql`${clients.lastPurchaseDate} IS NOT NULL`,
      sql`${clients.purchaseFrequencyDays} IS NOT NULL`,
    ));

  const totalSales = parseFloat(salesSummary?.totalSales ?? "0");
  const salesCount = salesSummary?.salesCount ?? 0;
  const repurchaseAlerts = repurchaseCandidates
    .map((client) => {
      const lastPurchaseDate = client.lastPurchaseDate ? new Date(client.lastPurchaseDate) : null;
      const purchaseFrequencyDays = Number(client.purchaseFrequencyDays ?? 0);
      if (!lastPurchaseDate || !purchaseFrequencyDays) return null;

      const daysSinceLastPurchase = Math.max(0, Math.floor((Date.now() - lastPurchaseDate.getTime()) / 86400000));
      const daysUntilRepurchase = purchaseFrequencyDays - daysSinceLastPurchase;
      const status =
        daysSinceLastPurchase > purchaseFrequencyDays
          ? "atrasado"
          : daysSinceLastPurchase >= Math.max(purchaseFrequencyDays - 7, 0)
            ? "proximo"
            : "em_dia";

      if (status === "em_dia") return null;

      return {
        id: client.id,
        clientName: client.farmName || client.producerName || `Cliente #${client.id}`,
        city: client.city,
        lastPurchaseDate,
        purchaseFrequencyDays,
        daysSinceLastPurchase,
        daysUntilRepurchase,
        status,
      };
    })
    .filter((client): client is NonNullable<typeof client> => Boolean(client))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "atrasado" ? -1 : 1;
      return b.daysSinceLastPurchase - a.daysSinceLastPurchase;
    });

  return {
    totalSales,
    salesCount,
    averageTicket: salesCount > 0 ? totalSales / salesCount : 0,
    alerts: {
      staleQuotes: staleQuotes.map((quote) => ({
        ...quote,
        daysWithoutResponse: Math.floor((Date.now() - new Date(quote.createdAt).getTime()) / 86400000),
      })),
      stalledOpportunities: stalledOpportunities.map((opportunity) => ({
        ...opportunity,
        stalledDays: Math.floor((Date.now() - new Date(opportunity.updatedAt).getTime()) / 86400000),
      })),
      repurchase: repurchaseAlerts,
    },
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
    .where(and(eq(sales.companyId, companyId), gte(sales.saleDate, startDate), lte(sales.saleDate, endDate)));
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

export async function getAllInteractionsCount(companyId: number, filters?: { type?: string; visitResult?: string; fromDate?: Date; toDate?: Date; }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [eq(interactions.companyId, companyId)];
  if (filters?.type) conditions.push(eq(interactions.type, filters.type));
  if (filters?.visitResult) conditions.push(eq(interactions.visitResult as any, filters.visitResult));
  if (filters?.fromDate) conditions.push(gte(interactions.date, filters.fromDate));
  if (filters?.toDate) conditions.push(lte(interactions.date, filters.toDate));

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(interactions)
    .where(and(...conditions));

  return result?.count ?? 0;
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
// ========== SUPERADMIN ACCESS MANAGEMENT ==========
export async function listAllUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: users.id, name: users.name, email: users.email, role: users.role,
    companyId: users.companyId, companyName: companies.name,
    paidUntil: users.paidUntil, trialEndsAt: users.trialEndsAt,
    createdAt: users.createdAt, lastSignedIn: users.lastSignedIn,
  })
  .from(users)
  .leftJoin(companies, eq(users.companyId, companies.id))
  .orderBy(desc(users.createdAt));
}

export async function grantAccess(userId: number, days: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const current = await db.select({ paidUntil: users.paidUntil }).from(users).where(eq(users.id, userId)).limit(1);
  const base = current[0]?.paidUntil && current[0].paidUntil > now ? current[0].paidUntil : now;
  const paidUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await db.update(users).set({ paidUntil }).where(eq(users.id, userId));
  return { paidUntil };
}

export async function revokeAccess(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.update(users).set({ paidUntil: yesterday }).where(eq(users.id, userId));
}

export async function setAccessUntil(userId: number, until: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ paidUntil: until }).where(eq(users.id, userId));
}
export async function getClientsCount(filters?: { search?: string; animalType?: string; status?: string; clientType?: string; assignedTo?: number; userId?: number; role?: string; companyId?: number; }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [];
  if (filters?.search) conditions.push(sql`(${clients.farmName} ILIKE ${`%${filters.search}%`} OR ${clients.producerName} ILIKE ${`%${filters.search}%`} OR ${clients.notes} ILIKE ${`%${filters.search}%`})`);
  if (filters?.animalType) conditions.push(eq(clients.animalType, filters.animalType as any));
  if (filters?.status) conditions.push(eq(clients.status, filters.status as any));
  if (filters?.clientType) conditions.push(eq(clients.clientType, filters.clientType as any));
  if (filters?.assignedTo) conditions.push(eq(clients.assignedTo, filters.assignedTo));
  if (filters?.role === "vendedor" && filters?.userId) conditions.push(or(eq(clients.assignedTo, filters.userId), eq(clients.createdBy, filters.userId)));
  if (filters?.companyId) conditions.push(eq(clients.companyId, filters.companyId));
  const q = db.select({ count: sql<number>`count(*)::int` }).from(clients);
  const result = await (conditions.length > 0 ? q.where(and(...conditions)) : q);
  return result[0]?.count ?? 0;
}


// ===== USUÁRIOS / REPRESENTANTES =====
export async function getUsersByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.companyId, companyId));
}

export async function updateUser(id: number, data: { name?: string; email?: string; role?: string; active?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.update(users).set(data).where(eq(users.id, id)).returning();
}

// ===== ORÇAMENTOS SIMPLES =====
export async function getOrcamentosSimples(companyId?: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (companyId) conditions.push(eq(orcamentosSimples.companyId, companyId));
  if (userId) conditions.push(eq(orcamentosSimples.userId, userId));
  if (conditions.length > 0) {
    return db.select().from(orcamentosSimples).where(and(...conditions)).orderBy(desc(orcamentosSimples.criadoEm));
  }
  return db.select().from(orcamentosSimples).orderBy(desc(orcamentosSimples.criadoEm));
}

export async function createOrcamentoSimples(data: {
  userId: number;
  companyId: number;
  clienteNome: string;
  clienteEmail?: string;
  produtos: any[];
  total: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.insert(orcamentosSimples).values({
    userId: data.userId,
    companyId: data.companyId,
    clienteNome: data.clienteNome,
    clienteEmail: data.clienteEmail,
    produtos: data.produtos,
    total: String(data.total),
    status: data.status || 'rascunho',
  }).returning();
}

export async function updateOrcamentoSimples(id: number, data: {
  clienteNome?: string;
  clienteEmail?: string;
  produtos?: any[];
  total?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.update(orcamentosSimples)
    .set({
      ...(data.clienteNome && { clienteNome: data.clienteNome }),
      ...(data.clienteEmail !== undefined && { clienteEmail: data.clienteEmail }),
      ...(data.produtos && { produtos: data.produtos }),
      ...(data.total !== undefined && { total: String(data.total) }),
      ...(data.status && { status: data.status }),
    })
    .where(eq(orcamentosSimples.id, id))
    .returning();
}

export async function deleteOrcamentoSimples(id: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  return db.delete(orcamentosSimples).where(eq(orcamentosSimples.id, id)).returning();
}

// ===== DASHBOARD GESTOR =====
export async function getManagerStats(companyId: number, fromDate?: Date, toDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const conditions: any[] = [eq(interactions.companyId, companyId)];
  if (fromDate) conditions.push(gte(interactions.date, fromDate));
  if (toDate) conditions.push(lte(interactions.date, toDate));
  
  // Buscar todas as interações do período com info do usuário
  const allInteractions = await db.select({
    id: interactions.id,
    type: interactions.type,
    title: interactions.title,
    date: interactions.date,
    duration: interactions.duration,
    visitResult: interactions.visitResult,
    createdBy: interactions.createdBy,
    clientId: interactions.clientId,
    clientName: clients.farmName,
  })
  .from(interactions)
  .leftJoin(clients, eq(interactions.clientId, clients.id))
  .where(and(...conditions))
  .orderBy(desc(interactions.date));
  
  // Buscar usuários da empresa
  const companyUsers = await db.select().from(users).where(eq(users.companyId, companyId));
  
  // Buscar oportunidades por usuário
  const oppsConditions: any[] = [eq(opportunities.companyId, companyId)];
  if (fromDate) oppsConditions.push(gte(opportunities.createdAt, fromDate));
  if (toDate) oppsConditions.push(lte(opportunities.createdAt, toDate));
  
  const allOpportunities = await db.select({
    id: opportunities.id,
    stage: opportunities.stage,
    value: opportunities.value,
    createdBy: opportunities.assignedTo,
    clientId: opportunities.clientId,
  })
  .from(opportunities)
  .where(and(...oppsConditions));
  
  // Buscar orçamentos do período
  const orcConditions: any[] = [eq(orcamentosSimples.companyId, companyId)];
  if (fromDate) orcConditions.push(gte(orcamentosSimples.criadoEm, fromDate));
  if (toDate) orcConditions.push(lte(orcamentosSimples.criadoEm, toDate));
  
  const allOrcamentos = await db.select({
    id: orcamentosSimples.id,
    total: orcamentosSimples.total,
    status: orcamentosSimples.status,
    userId: orcamentosSimples.userId,
    clienteNome: orcamentosSimples.clienteNome,
  })
  .from(orcamentosSimples)
  .where(and(...orcConditions));
  
  return {
    interactions: allInteractions,
    users: companyUsers,
    opportunities: allOpportunities,
    orcamentos: allOrcamentos,
  };
}

// ===== ALERTAS DE FOLLOW-UP =====
export async function getFollowUpAlerts(companyId: number, userId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const hoje = new Date();
  const ha7Dias = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ha15Dias = new Date(hoje.getTime() - 15 * 24 * 60 * 60 * 1000);
  
  // Buscar clientes sem interação há mais de 7 dias
  const clientesRecentes = await db.select({
    clientId: interactions.clientId,
    ultimaData: sql`MAX(${interactions.date})`.as('ultimaData'),
  })
  .from(interactions)
  .where(eq(interactions.companyId, companyId))
  .groupBy(interactions.clientId);
  
  const clientesRecentesMap = new Map(clientesRecentes.map((c: any) => [c.clientId, new Date(c.ultimaData)]));
  
  // Buscar todos os clientes da empresa
  const clientesConditions = [eq(clients.companyId, companyId)];
  if (userId) {
    clientesConditions.push(eq(clients.assignedTo, userId));
  }
  const clientesQuery = db.select().from(clients).where(and(...clientesConditions));
  const todosClientes = await clientesQuery;
  
  const alertas = [];
  
  for (const cliente of todosClientes) {
    const ultimaInteracao = clientesRecentesMap.get(cliente.id);
    
    if (!ultimaInteracao || ultimaInteracao < ha7Dias) {
      const diasSemContato = ultimaInteracao 
        ? Math.floor((hoje.getTime() - ultimaInteracao.getTime()) / (24 * 60 * 60 * 1000))
        : 999;
      
      alertas.push({
        tipo: 'followup',
        clienteId: cliente.id,
        clienteNome: cliente.farmName || cliente.producerName,
        diasSemContato,
        urgencia: diasSemContato > 15 ? 'alta' : diasSemContato > 7 ? 'media' : 'baixa',
        ultimaInteracao: ultimaInteracao?.toISOString() || null,
      });
    }
  }
  
  // Buscar orçamentos enviados há mais de 5 dias sem resposta
  const orcamentosPendentes = await db.select()
    .from(orcamentosSimples)
    .where(
      and(
        eq(orcamentosSimples.companyId, companyId),
        eq(orcamentosSimples.status, 'enviado'),
        lte(orcamentosSimples.criadoEm, new Date(hoje.getTime() - 5 * 24 * 60 * 60 * 1000))
      )
    );
  
  for (const orc of orcamentosPendentes) {
    const diasEnviado = Math.floor((hoje.getTime() - new Date(orc.criadoEm).getTime()) / (24 * 60 * 60 * 1000));
    alertas.push({
      tipo: 'orcamento',
      orcamentoId: orc.id,
      clienteNome: orc.clienteNome,
      diasSemResposta: diasEnviado,
      urgencia: diasEnviado > 10 ? 'alta' : 'media',
      valor: orc.total,
    });
  }
  
  // Buscar oportunidades paradas em negociação há mais de 10 dias
  const oportunidadesParadas = await db.select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.companyId, companyId),
        eq(opportunities.stage, 'negociacao'),
        lte(opportunities.updatedAt, new Date(hoje.getTime() - 10 * 24 * 60 * 60 * 1000))
      )
    );
  
  for (const opp of oportunidadesParadas) {
    const diasParado = Math.floor((hoje.getTime() - new Date(opp.updatedAt).getTime()) / (24 * 60 * 60 * 1000));
    alertas.push({
      tipo: 'oportunidade',
      oportunidadeId: opp.id,
      titulo: opp.title,
      clienteId: opp.clientId,
      diasParado,
      urgencia: diasParado > 20 ? 'alta' : 'media',
      valor: opp.value,
    });
  }
  
  return alertas.sort((a: any, b: any) => {
    const urgenciaOrder = { alta: 0, media: 1, baixa: 2 };
    return urgenciaOrder[a.urgencia as keyof typeof urgenciaOrder] - urgenciaOrder[b.urgencia as keyof typeof urgenciaOrder];
  });
}

// ========== PUSH SUBSCRIPTIONS ==========

export async function savePushSubscription(data: {
  userId: number;
  companyId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(pushSubscriptions)
    .values({ ...data, enabled: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: data.userId,
        companyId: data.companyId,
        p256dh: data.p256dh,
        auth: data.auth,
        enabled: true,
        updatedAt: new Date(),
      },
    });
  return { success: true };
}

export async function deletePushSubscription(userId: number, endpoint: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  return { success: true };
}

export async function getPushSubscriptionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.enabled, true)));
}

export async function getPushSubscriptionsByCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.companyId, companyId), eq(pushSubscriptions.enabled, true)));
}

export async function disablePushSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pushSubscriptions)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function getUserPushEnabled(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.enabled, true)))
    .limit(1);
  return rows.length > 0;
}

export type ClearDataEntity =
  | "quoteItems"
  | "quotes"
  | "sales"
  | "interactions"
  | "opportunities"
  | "clients"
  | "products"
  | "monthlyGoals"
  | "pushSubscriptions"
  | "orcamentosSimples"
  | "users";

export async function clearCompanyData(
  companyId: number,
  entities: ClearDataEntity[],
  excludeUserId: number
): Promise<{ deleted: Record<ClearDataEntity, number> }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result: Record<ClearDataEntity, number> = {
    quoteItems: 0,
    quotes: 0,
    sales: 0,
    interactions: 0,
    opportunities: 0,
    clients: 0,
    products: 0,
    monthlyGoals: 0,
    pushSubscriptions: 0,
    orcamentosSimples: 0,
    users: 0,
  };

  const pool = (db as any).session?.client ?? (db as any).client;
  const client = await (pool as Pool).connect();

  try {
    await client.query("BEGIN");

    // Ordem de deleção respeitando dependências lógicas (filhos antes dos pais)
    const entityOrder: ClearDataEntity[] = [
      "quoteItems",
      "quotes",
      "sales",
      "interactions",
      "opportunities",
      "orcamentosSimples",
      "clients",
      "products",
      "monthlyGoals",
      "pushSubscriptions",
      "users",
    ];

    for (const entity of entityOrder) {
      if (!entities.includes(entity)) continue;

      let res;
      switch (entity) {
        case "quoteItems":
          // Deletar items de orçamentos da empresa
          res = await client.query(
            `DELETE FROM "quoteItems" qi USING "quotes" q WHERE qi."quoteId" = q.id AND q."companyId" = $1`,
            [companyId]
          );
          break;
        case "quotes":
          res = await client.query(`DELETE FROM "quotes" WHERE "companyId" = $1`, [companyId]);
          break;
        case "sales":
          res = await client.query(`DELETE FROM "sales" WHERE "companyId" = $1`, [companyId]);
          break;
        case "interactions":
          res = await client.query(`DELETE FROM "interactions" WHERE "companyId" = $1`, [companyId]);
          break;
        case "opportunities":
          res = await client.query(`DELETE FROM "opportunities" WHERE "companyId" = $1`, [companyId]);
          break;
        case "orcamentosSimples":
          res = await client.query(`DELETE FROM "orcamentos_simples" WHERE "company_id" = $1`, [companyId]);
          break;
        case "clients":
          res = await client.query(`DELETE FROM "clients" WHERE "companyId" = $1`, [companyId]);
          break;
        case "products":
          res = await client.query(`DELETE FROM "products" WHERE "companyId" = $1`, [companyId]);
          break;
        case "monthlyGoals":
          res = await client.query(`DELETE FROM "monthly_goals" WHERE "companyId" = $1`, [companyId]);
          break;
        case "pushSubscriptions":
          res = await client.query(`DELETE FROM "push_subscriptions" WHERE "company_id" = $1`, [companyId]);
          break;
        case "users":
          // Preservar o usuário que está executando a ação
          res = await client.query(
            `DELETE FROM "users" WHERE "companyId" = $1 AND id <> $2`,
            [companyId, excludeUserId]
          );
          break;
      }
      if (res) {
        result[entity] = res.rowCount ?? 0;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { deleted: result };
}

// ========== IMPORTAÇÃO DE VENDAS ==========

export interface ImportSaleRow {
  dataNF: Date;
  dataPedido?: Date;
  codCliente: string;
  nomeCliente: string;
  codProduto: string;
  nomeProduto: string;
  qtdeSacos: number;
  precoSaco: number;
  representante: string;
  municipio: string;
  uf: string;
  notaFiscal?: string;
  pedido?: string;
  segmentacao?: string;
  categoria?: string;
  precoKg?: number;
  descontoPct?: number;
  descontoValor?: number;
  faturamento?: number;
  bonificacaoQtde?: number;
  bonificacaoValor?: number;
  valorFinal?: number;
  linha?: string;
  // Campos adicionais de métricas
  volumeSacos?: number;
  volumeKg?: number;
  custoTotal?: number;
  despesaComercial?: number;
  frete?: number;
  margemBrutaPercent?: number;
  margemBrutaValor?: number;
  margemLiquidaPercent?: number;
  margemLiquidaValor?: number;
  comissaoPercent?: number;
  comissaoValor?: number;
  icms?: number;
  pis?: number;
  cofins?: number;
  grupoProduto?: string;
  solucao?: string;
  subsolucao?: string;
  grv?: string;
  gnv?: string;
  filial?: string;
  codigoCFOP?: string;
  mesAno?: string;
  ano?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: number;
  details: {
    representantes: { created: number; existing: number };
    clientes: { created: number; existing: number };
    produtos: { created: number; existing: number };
    vendas: { created: number; existing: number };
  };
  errorDetails: string[];
}

function normalizeImportText(value?: string | number | null): string {
  return String(value ?? "").trim();
}

export async function getManagerDashboardSummary(companyId: number, fromDate?: Date, toDate?: Date) {
  const stats = await getManagerStats(companyId, fromDate, toDate);

  const userMap = new Map<number, {
    id: number;
    name: string;
    email: string | null;
    totalInteractions: number;
    visitas: number;
    ligacoes: number;
    reunioes: number;
    visitasConcluidas: number;
    visitasPerdidas: number;
    oportunidades: number;
    orcamentos: number;
    valorOrcamentos: number;
    tempoTotal: number;
  }>();

  stats.users.forEach((user: any) => {
    userMap.set(user.id, {
      id: user.id,
      name: user.name || user.email || `Vendedor ${user.id}`,
      email: user.email ?? null,
      totalInteractions: 0,
      visitas: 0,
      ligacoes: 0,
      reunioes: 0,
      visitasConcluidas: 0,
      visitasPerdidas: 0,
      oportunidades: 0,
      orcamentos: 0,
      valorOrcamentos: 0,
      tempoTotal: 0,
    });
  });

  stats.interactions.forEach((interaction: any) => {
    const user = userMap.get(interaction.createdBy);
    if (!user) return;
    user.totalInteractions++;
    user.tempoTotal += interaction.duration || 0;
    if (interaction.type === "visita") user.visitas++;
    if (interaction.type === "ligacao") user.ligacoes++;
    if (interaction.type === "reuniao") user.reunioes++;
    if (interaction.visitResult === "sucesso") user.visitasConcluidas++;
    if (interaction.visitResult === "perdido") user.visitasPerdidas++;
  });

  stats.opportunities.forEach((opportunity: any) => {
    const user = userMap.get(opportunity.createdBy);
    if (user) user.oportunidades++;
  });

  stats.orcamentos.forEach((quote: any) => {
    const user = userMap.get(quote.userId);
    if (!user) return;
    user.orcamentos++;
    user.valorOrcamentos += parseFloat(quote.total || 0);
  });

  const vendedorStats = Array.from(userMap.values()).sort((a, b) => b.totalInteractions - a.totalInteractions);

  return {
    totals: {
      totalInteractions: stats.interactions.length,
      totalVisits: stats.interactions.filter((interaction: any) => interaction.type === "visita").length,
      totalQuotes: stats.orcamentos.length,
      totalQuoteValue: stats.orcamentos.reduce((sum: number, quote: any) => sum + parseFloat(quote.total || 0), 0),
    },
    vendedorStats,
  };
}

function buildImportKey(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => normalizeImportText(part).toLowerCase()).join("|");
}

async function findRepresentanteIdByName(companyId: number, nome: string): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedName = normalizeImportText(nome) || "Sem Representante";
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.companyId, companyId),
        eq(users.role, "vendedor"),
        sql`LOWER(${users.name}) = LOWER(${normalizedName})`
      )
    )
    .limit(1);

  return existing[0]?.id ?? null;
}

async function findClienteId(companyId: number, codigo: string, nome: string): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedCode = normalizeImportText(codigo);
  const normalizedName = normalizeImportText(nome);
  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.companyId, companyId),
        normalizedCode
          ? eq(clients.externalCode, normalizedCode)
          : sql`LOWER(${clients.farmName}) = LOWER(${normalizedName})`
      )
    )
    .limit(1);

  return existing[0]?.id ?? null;
}

async function findProdutoId(companyId: number, codigo: string, nome: string): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedCode = normalizeImportText(codigo);
  const normalizedName = normalizeImportText(nome);
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        normalizedCode
          ? eq(products.externalCode, normalizedCode)
          : sql`LOWER(${products.name}) = LOWER(${normalizedName})`
      )
    )
    .limit(1);

  return existing[0]?.id ?? null;
}

export async function createRepresentante(
  nome: string,
  companyId: number
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedName = normalizeImportText(nome) || "Sem Representante";
  const existingId = await findRepresentanteIdByName(companyId, normalizedName);
  if (existingId) {
    return { id: existingId };
  }

  const bcrypt = await import("bcryptjs");
  const tempPassword = Math.random().toString(36).slice(2, 10);
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const result = await db
    .insert(users)
    .values({
      companyId,
      openId: `rep_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: normalizedName,
      email: `temp_${Date.now()}@placeholder.com`,
      passwordHash,
      role: "vendedor",
      loginMethod: "email",
      lastSignedIn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: users.id });

  return { id: result[0].id };
}

export async function createCliente(
  data: {
    codigo: string;
    nome: string;
    municipio: string;
    uf: string;
    email?: string;
    telefone?: string;
    segmentacao?: string;
  },
  companyId: number,
  createdBy: number
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedCode = normalizeImportText(data.codigo);
  const normalizedName = normalizeImportText(data.nome);
  const existingId = await findClienteId(companyId, normalizedCode, normalizedName);
  if (existingId) {
    return { id: existingId };
  }

  const result = await db
    .insert(clients)
    .values({
      companyId,
      externalCode: normalizedCode || null,
      clientType: "fazenda",
      farmName: normalizedName,
      producerName: normalizedName,
      email: data.email || null,
      phone: data.telefone || null,
      city: data.municipio,
      state: data.uf,
      address: `${data.municipio}, ${data.uf}`,
      notes: normalizedCode ? `Código importado: ${normalizedCode}` : null,
      status: "ativo",
      createdBy,
      animalType: "bovinos",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: clients.id });

  return { id: result[0].id };
}

export async function createProduto(
  data: {
    codigo: string;
    nome: string;
    preco?: number;
    linha?: string;
  },
  companyId: number
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const normalizedCode = normalizeImportText(data.codigo);
  const normalizedName = normalizeImportText(data.nome);
  const existingId = await findProdutoId(companyId, normalizedCode, normalizedName);
  if (existingId) {
    return { id: existingId };
  }

  const result = await db
    .insert(products)
    .values({
      companyId,
      externalCode: normalizedCode || null,
      name: normalizedName,
      category: data.linha || "Outros",
      productCode: normalizedCode || null,
      price: data.preco?.toString() || "0",
      description: `Importado em ${new Date().toISOString()}`,
      unit: "saco",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: products.id });

  return { id: result[0].id };
}

export async function findOrCreateProduto(
  data: {
    codigo: string;
    nome: string;
    preco?: number;
    linha?: string;
  },
  companyId: number
): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar por código no productCode ou nome
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.companyId, companyId),
        or(
          sql`LOWER(${products.productCode}) = LOWER(${data.codigo})`,
          sql`LOWER(${products.name}) = LOWER(${data.nome})`
        )
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, created: false };
  }

  // Criar novo produto
  const result = await db
    .insert(products)
    .values({
      companyId,
      name: data.nome,
      category: data.linha || "Outros",
      productCode: data.codigo,
      price: data.preco?.toString() || "0",
      description: `Importado em ${new Date().toISOString()}`,
      unit: "saco",
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: products.id });

  return { id: result[0].id, created: true };
}

export async function createSaleFromImport(
  data: ImportSaleRow,
  companyId: number,
  userId: number,
  clientId: number,
  productId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalValue = data.faturamento || data.qtdeSacos * data.precoSaco;
  const bonusValue = data.bonificacaoValor || 0;
  const bonusQuantity = data.bonificacaoQtde || 0;
  const discountPercent = data.descontoPct || 0;
  const discountValue = data.descontoValor || (totalValue * discountPercent / 100);
  const finalValue = data.valorFinal || (totalValue - discountValue);
  const importKey = buildImportKey([
    "sale",
    companyId,
    data.notaFiscal || "",
    data.pedido || "",
    data.codCliente,
    data.codProduto,
    data.dataNF instanceof Date ? data.dataNF.toISOString().slice(0, 10) : data.dataNF,
  ]);
  const saleNumber = `IMP_${importKey.slice(0, 42)}`;

  const existing = await db
    .select({ id: sales.id })
    .from(sales)
    .where(and(eq(sales.companyId, companyId), eq(sales.importKey, importKey)))
    .limit(1);

  if (existing.length > 0) {
    return false;
  }

  await db.insert(sales).values({
    companyId,
    importKey,
    clientId,
    saleNumber,
    notaFiscal: data.notaFiscal || null,
    pedidoNumber: data.pedido || null,
    totalValue: totalValue.toString(),
    discountValue: discountValue.toString(),
    discountPercent: discountPercent.toString(),
    bonusValue: bonusValue.toString(),
    bonusQuantity,
    finalValue: finalValue.toString(),
    // Métricas de volume
    volumeSacos: (data.volumeSacos || data.qtdeSacos).toString(),
    volumeKg: (data.volumeKg || 0).toString(),
    precoPorKg: (data.precoKg || 0).toString(),
    // Custos
    custoTotal: (data.custoTotal || 0).toString(),
    despesaComercial: (data.despesaComercial || 0).toString(),
    frete: (data.frete || 0).toString(),
    // Margens
    margemBrutaPercent: (data.margemBrutaPercent || 0).toString(),
    margemBrutaValor: (data.margemBrutaValor || 0).toString(),
    margemLiquidaPercent: (data.margemLiquidaPercent || 0).toString(),
    margemLiquidaValor: (data.margemLiquidaValor || 0).toString(),
    // Comissões
    comissaoPercent: (data.comissaoPercent || 0).toString(),
    comissaoValor: (data.comissaoValor || 0).toString(),
    // Impostos
    icms: (data.icms || 0).toString(),
    pis: (data.pis || 0).toString(),
    cofins: (data.cofins || 0).toString(),
    // Classificação
    grupoProduto: data.grupoProduto || null,
    solucao: data.solucao || null,
    subsolucao: data.subsolucao || null,
    linha: data.linha || null,
    grv: data.grv || null,
    gnv: data.gnv || null,
    filial: data.filial || null,
    codigoCFOP: data.codigoCFOP || null,
    mesAno: data.mesAno || null,
    ano: data.ano || null,
    paymentStatus: "pago",
    saleDate: data.dataNF,
    notes: `Pedido: ${data.pedido || "N/A"} | Segmentação: ${data.segmentacao || "N/A"} | Categoria: ${data.categoria || "N/A"} | Bonificação: ${bonusQuantity} un / R$ ${bonusValue}`,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return true;
}

function buildSaleImportKey(data: ImportSaleRow, companyId: number): string {
  return buildImportKey([
    "sale",
    companyId,
    data.notaFiscal || "",
    data.pedido || "",
    data.codCliente,
    data.codProduto,
    data.dataNF instanceof Date ? data.dataNF.toISOString().slice(0, 10) : data.dataNF,
  ]);
}

export async function importSalesData(
  rows: ImportSaleRow[],
  companyId: number,
  userId: number
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    errors: 0,
    details: {
      representantes: { created: 0, existing: 0 },
      clientes: { created: 0, existing: 0 },
      produtos: { created: 0, existing: 0 },
      vendas: { created: 0, existing: 0 },
    },
    errorDetails: [],
  };

  const representantesCache = new Map<string, number>();
  const clientesCache = new Map<string, number>();
  const produtosCache = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let representanteId: number;
      const repCacheKey = `${companyId}_${row.representante}`;
      if (representantesCache.has(repCacheKey)) {
        representanteId = representantesCache.get(repCacheKey)!;
        result.details.representantes.existing++;
      } else {
        const existingRepId = await findRepresentanteIdByName(companyId, row.representante || "Sem Representante");
        const rep = await createRepresentante(row.representante || 'Sem Representante', companyId);
        representanteId = rep.id;
        representantesCache.set(repCacheKey, rep.id);
        if (existingRepId) {
          result.details.representantes.existing++;
        } else {
          result.details.representantes.created++;
        }
      }

      let clienteId: number;
      const cliCacheKey = `${companyId}_${row.codCliente}`;
      if (clientesCache.has(cliCacheKey)) {
        clienteId = clientesCache.get(cliCacheKey)!;
        result.details.clientes.existing++;
      } else {
        const existingClientId = await findClienteId(companyId, row.codCliente, row.nomeCliente);
        const cli = await createCliente(
          {
            codigo: row.codCliente,
            nome: row.nomeCliente,
            municipio: row.municipio || '',
            uf: row.uf || '',
            segmentacao: row.segmentacao,
          },
          companyId,
          userId
        );
        clienteId = cli.id;
        clientesCache.set(cliCacheKey, cli.id);
        if (existingClientId) {
          result.details.clientes.existing++;
        } else {
          result.details.clientes.created++;
        }
      }

      let produtoId: number;
      const prodCacheKey = `${companyId}_${row.codProduto}`;
      if (produtosCache.has(prodCacheKey)) {
        produtoId = produtosCache.get(prodCacheKey)!;
        result.details.produtos.existing++;
      } else {
        const existingProductId = await findProdutoId(companyId, row.codProduto, row.nomeProduto);
        const prod = await createProduto(
          {
            codigo: row.codProduto,
            nome: row.nomeProduto,
            preco: row.precoSaco,
            linha: row.linha,
          },
          companyId
        );
        produtoId = prod.id;
        produtosCache.set(prodCacheKey, prod.id);
        if (existingProductId) {
          result.details.produtos.existing++;
        } else {
          result.details.produtos.created++;
        }
      }

      const created = await createSaleFromImport(row, companyId, userId, clienteId, produtoId);
      if (created) {
        result.details.vendas.created++;
        result.imported++;
      } else {
        result.details.vendas.existing++;
      }
    } catch (err: any) {
      result.errors++;
      result.errorDetails.push(`Linha ${i + 1}: ${err.message || String(err)}`);
    }
  }

  result.success = result.errors === 0;
  return result;
}

// ========== IMPORTAÇÃO DE PEDIDOS EM CARTEIRA ==========

export interface ImportPedidoRow {
  dataPedido: Date;
  dataPrevFaturamento?: Date;
  codCliente: string;
  nomeCliente: string;
  codProduto: string;
  nomeProduto: string;
  qtdeSacos: number;
  precoSaco: number;
  representante?: string;
  municipio?: string;
  uf?: string;
  pedidoNumber: string;
  notaFiscal?: string;
  segmentacao?: string;
  categoria?: string;
  linha?: string;
}

export async function createPedidoFromImport(
  data: ImportPedidoRow,
  companyId: number,
  userId: number,
  clientId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalValue = data.qtdeSacos * data.precoSaco;
  const importKey = buildImportKey([
    "pedido",
    companyId,
    data.pedidoNumber || "",
    data.notaFiscal || "",
    data.codCliente,
    data.codProduto,
    data.dataPedido instanceof Date ? data.dataPedido.toISOString().slice(0, 10) : data.dataPedido,
  ]);

  await db.insert(pedidosCarteira).values({
    companyId,
    importKey,
    clientId,
    pedidoNumber: data.pedidoNumber,
    status: "pendente",
    totalValue: totalValue.toString(),
    qtdeSacos: data.qtdeSacos,
    precoSaco: data.precoSaco.toString(),
    dataPedido: data.dataPedido,
    dataPrevFaturamento: data.dataPrevFaturamento,
    representante: data.representante,
    notaFiscal: data.notaFiscal,
    observacoes: `Produto: ${data.nomeProduto} | Cód: ${data.codProduto} | Segmentação: ${data.segmentacao || "N/A"}`,
    createdBy: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function importPedidosData(
  rows: ImportPedidoRow[],
  companyId: number,
  userId: number
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: 0,
    errors: 0,
    details: {
      representantes: { created: 0, existing: 0 },
      clientes: { created: 0, existing: 0 },
      produtos: { created: 0, existing: 0 },
      vendas: { created: 0, existing: 0 },
    },
    errorDetails: [],
  };

  const representantesCache = new Map<string, number>();
  const clientesCache = new Map<string, number>();
  const produtosCache = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let representanteId: number;
      const repCacheKey = `${companyId}_${row.representante}`;
      if (representantesCache.has(repCacheKey)) {
        representanteId = representantesCache.get(repCacheKey)!;
        result.details.representantes.existing++;
      } else {
        const existingRepId = await findRepresentanteIdByName(companyId, row.representante || "Sem Representante");
        const rep = await createRepresentante(row.representante || 'Sem Representante', companyId);
        representanteId = rep.id;
        representantesCache.set(repCacheKey, rep.id);
        if (existingRepId) {
          result.details.representantes.existing++;
        } else {
          result.details.representantes.created++;
        }
      }

      let clienteId: number;
      const cliCacheKey = `${companyId}_${row.codCliente}`;
      if (clientesCache.has(cliCacheKey)) {
        clienteId = clientesCache.get(cliCacheKey)!;
        result.details.clientes.existing++;
      } else {
        const existingClientId = await findClienteId(companyId, row.codCliente, row.nomeCliente);
        const cli = await createCliente(
          {
            codigo: row.codCliente,
            nome: row.nomeCliente,
            municipio: row.municipio || '',
            uf: row.uf || '',
            segmentacao: row.segmentacao,
          },
          companyId,
          userId
        );
        clienteId = cli.id;
        clientesCache.set(cliCacheKey, cli.id);
        if (existingClientId) {
          result.details.clientes.existing++;
        } else {
          result.details.clientes.created++;
        }
      }

      let produtoId: number;
      const prodCacheKey = `${companyId}_${row.codProduto}`;
      if (produtosCache.has(prodCacheKey)) {
        produtoId = produtosCache.get(prodCacheKey)!;
        result.details.produtos.existing++;
      } else {
        const existingProductId = await findProdutoId(companyId, row.codProduto, row.nomeProduto);
        const prod = await createProduto(
          {
            codigo: row.codProduto,
            nome: row.nomeProduto,
            preco: row.precoSaco,
            linha: row.linha,
          },
          companyId
        );
        produtoId = prod.id;
        produtosCache.set(prodCacheKey, prod.id);
        if (existingProductId) {
          result.details.produtos.existing++;
        } else {
          result.details.produtos.created++;
        }
      }

      // Criar pedido em carteira
      const importKey = buildImportKey([
        "pedido",
        companyId,
        row.pedidoNumber || "",
        row.notaFiscal || "",
        row.codCliente,
        row.codProduto,
        row.dataPedido instanceof Date ? row.dataPedido.toISOString().slice(0, 10) : row.dataPedido,
      ]);
      const db = await getDb();
      const existingPedido = db
        ? await db.select({ id: pedidosCarteira.id }).from(pedidosCarteira).where(and(eq(pedidosCarteira.companyId, companyId), eq(pedidosCarteira.importKey, importKey))).limit(1)
        : [];
      if (existingPedido.length > 0) {
        result.details.vendas.existing++;
        continue;
      }

      await createPedidoFromImport(row, companyId, userId, clienteId);
      result.details.vendas.created++;
      result.imported++;
    } catch (err: any) {
      result.errors++;
      const errMsg = err.message || String(err);
      console.error(`[importPedidosData] Row ${i + 1} error:`, errMsg, 'row:', JSON.stringify({ codCliente: row.codCliente, codProduto: row.codProduto }));
      result.errorDetails.push(`Linha ${i + 1} (${row.codCliente || '?'} / ${row.codProduto || '?'}): ${errMsg}`);
    }
  }

  result.success = result.errors === 0;
  return result;
}

// ========== PEDIDOS EM ABERTO (CARTEIRA) ==========

export interface PedidoCarteiraFiltros {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getPedidosCarteira(
  companyId: number,
  filtros: PedidoCarteiraFiltros = {}
): Promise<{ data: any[]; total: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { status, limit = 50, offset = 0 } = filtros;

  const conditions: any[] = [eq(pedidosCarteira.companyId, companyId)];

  if (status && status !== 'todos') {
    conditions.push(eq(pedidosCarteira.status, status));
  } else {
    conditions.push(eq(pedidosCarteira.status, 'pendente'));
  }

  const [data, countResult] = await Promise.all([
    db
      .select({
        id: pedidosCarteira.id,
        companyId: pedidosCarteira.companyId,
        clientId: pedidosCarteira.clientId,
        pedidoNumber: pedidosCarteira.pedidoNumber,
        status: pedidosCarteira.status,
        totalValue: pedidosCarteira.totalValue,
        qtdeSacos: pedidosCarteira.qtdeSacos,
        precoSaco: pedidosCarteira.precoSaco,
        dataPedido: pedidosCarteira.dataPedido,
        dataPrevFaturamento: pedidosCarteira.dataPrevFaturamento,
        representante: pedidosCarteira.representante,
        notaFiscal: pedidosCarteira.notaFiscal,
        observacoes: pedidosCarteira.observacoes,
        createdAt: pedidosCarteira.createdAt,
        clienteNome: clients.farmName,
      })
      .from(pedidosCarteira)
      .leftJoin(clients, eq(pedidosCarteira.clientId, clients.id))
      .where(and(...conditions))
      .orderBy(desc(pedidosCarteira.dataPedido))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(pedidosCarteira)
      .where(and(...conditions)),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

// ========== IMPORTAÇÃO AVULSA DE ENTIDADES ==========

export interface ImportClienteRow {
  codigo: string;
  nome: string;
  email?: string;
  telefone?: string;
  municipio?: string;
  uf?: string;
  endereco?: string;
  segmentacao?: string;
  categoria?: string;
  status?: string;
}

export interface ImportProdutoRow {
  codigo: string;
  nome: string;
  preco?: number;
  categoria?: string;
  linha?: string;
  unidade?: string;
  descricao?: string;
}

export interface ImportRepresentanteRow {
  nome: string;
  email?: string;
  telefone?: string;
  regiao?: string;
}

export async function importClientesAvulso(
  rows: ImportClienteRow[],
  companyId: number,
  userId: number
): Promise<{ success: boolean; imported: number; errors: number; errorDetails: string[] }> {
  const result = { success: true, imported: 0, errors: 0, errorDetails: [] as string[] };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createCliente({
        codigo: row.codigo,
        nome: row.nome,
        municipio: row.municipio || '',
        uf: row.uf || '',
        email: row.email,
        telefone: row.telefone,
        segmentacao: row.segmentacao,
      }, companyId, userId);
      result.imported++;
    } catch (err: any) {
      result.errors++;
      result.errorDetails.push(`Linha ${i + 1}: ${err.message || String(err)}`);
    }
  }
  
  result.success = result.errors === 0;
  return result;
}

export async function importProdutosAvulso(
  rows: ImportProdutoRow[],
  companyId: number
): Promise<{ success: boolean; imported: number; errors: number; errorDetails: string[] }> {
  const result = { success: true, imported: 0, errors: 0, errorDetails: [] as string[] };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createProduto({
        codigo: row.codigo,
        nome: row.nome,
        preco: row.preco,
        linha: row.linha,
      }, companyId);
      result.imported++;
    } catch (err: any) {
      result.errors++;
      result.errorDetails.push(`Linha ${i + 1}: ${err.message || String(err)}`);
    }
  }
  
  result.success = result.errors === 0;
  return result;
}

export async function importRepresentantesAvulso(
  rows: ImportRepresentanteRow[],
  companyId: number
): Promise<{ success: boolean; imported: number; errors: number; errorDetails: string[] }> {
  const result = { success: true, imported: 0, errors: 0, errorDetails: [] as string[] };
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      await createRepresentante(row.nome || 'Sem Nome', companyId);
      result.imported++;
    } catch (err: any) {
      result.errors++;
      result.errorDetails.push(`Linha ${i + 1}: ${err.message || String(err)}`);
    }
  }
  
  result.success = result.errors === 0;
  return result;
}

