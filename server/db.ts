import { eq, and, like, desc, asc, gte, lte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
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

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(clients).values(data);
  return result;
}

export async function getClients(filters?: {
  search?: string;
  animalType?: string;
  status?: string;
  limit?: number;
  offset?: number;
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(products).values(data);
}

export async function getProducts(filters?: {
  search?: string;
  category?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(opportunities).values(data);
}

export async function getOpportunities(filters?: {
  clientId?: number;
  stage?: string;
  assignedTo?: number;
  limit?: number;
  offset?: number;
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(quotes).values(data);
}

export async function getQuotes(filters?: {
  clientId?: number;
  status?: string;
  limit?: number;
  offset?: number;
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(interactions).values(data);
}

export async function getInteractions(filters?: {
  clientId?: number;
  opportunityId?: number;
  type?: string;
  limit?: number;
  offset?: number;
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(sales).values(data);
}

export async function getSales(filters?: {
  clientId?: number;
  paymentStatus?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
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

export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Total sales value
  const totalSalesResult = await db
    .select({
      total: sql<string>`SUM(${sales.totalValue})`,
    })
    .from(sales)
    ;

  // Total opportunities
  const totalOpportunitiesResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(opportunities)
    ;

  // Opportunities by stage
  const opportunitiesByStage = await db
    .select({
      stage: opportunities.stage,
      count: sql<number>`COUNT(*)`,
    })
    .from(opportunities)
    
    .groupBy(opportunities.stage);

  // Total clients
  const totalClientsResult = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(clients)
    ;

  return {
    totalSales: totalSalesResult[0]?.total || "0",
    totalOpportunities: totalOpportunitiesResult[0]?.count || 0,
    totalClients: totalClientsResult[0]?.count || 0,
    opportunitiesByStage,
  };
}


