// ========== FUNÇÕES DE AGREGAÇÃO DE MÉTRICAS ==========

export interface MetricasVendas {
  totalFaturamento: number;
  totalVolumeSacos: number;
  totalVolumeKg: number;
  totalMargemBrutaValor: number;
  totalMargemLiquidaValor: number;
  mediaMargemBrutaPercent: number;
  mediaMargemLiquidaPercent: number;
  totalCusto: number;
  totalDespesaComercial: number;
  totalFrete: number;
  totalComissao: number;
  totalImpostos: number;
  count: number;
}

export async function getMetricasPorPeriodo(
  companyId: number,
  mesAno: string
): Promise<MetricasVendas> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      totalFaturamento: sql<number>`COALESCE(SUM(CAST(${sales.finalValue} AS DECIMAL)), 0)`,
      totalVolumeSacos: sql<number>`COALESCE(SUM(CAST(${sales.volumeSacos} AS DECIMAL)), 0)`,
      totalVolumeKg: sql<number>`COALESCE(SUM(CAST(${sales.volumeKg} AS DECIMAL)), 0)`,
      totalMargemBrutaValor: sql<number>`COALESCE(SUM(CAST(${sales.margemBrutaValor} AS DECIMAL)), 0)`,
      totalMargemLiquidaValor: sql<number>`COALESCE(SUM(CAST(${sales.margemLiquidaValor} AS DECIMAL)), 0)`,
      mediaMargemBrutaPercent: sql<number>`COALESCE(AVG(CAST(${sales.margemBrutaPercent} AS DECIMAL)), 0)`,
      mediaMargemLiquidaPercent: sql<number>`COALESCE(AVG(CAST(${sales.margemLiquidaPercent} AS DECIMAL)), 0)`,
      totalCusto: sql<number>`COALESCE(SUM(CAST(${sales.custoTotal} AS DECIMAL)), 0)`,
      totalDespesaComercial: sql<number>`COALESCE(SUM(CAST(${sales.despesaComercial} AS DECIMAL)), 0)`,
      totalFrete: sql<number>`COALESCE(SUM(CAST(${sales.frete} AS DECIMAL)), 0)`,
      totalComissao: sql<number>`COALESCE(SUM(CAST(${sales.comissaoValor} AS DECIMAL)), 0)`,
      totalImpostos: sql<number>`COALESCE(SUM(CAST(${sales.icms} AS DECIMAL) + CAST(${sales.pis} AS DECIMAL) + CAST(${sales.cofins} AS DECIMAL)), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(sales)
    .where(and(eq(sales.companyId, companyId), eq(sales.mesAno, mesAno)));

  return result[0];
}

export async function getVendasPorFiltro(
  companyId: number,
  filtros: {
    mesAno?: string;
    representante?: string;
    clienteId?: number;
    produtoId?: number;
    ano?: number;
  },
  limit: number = 100,
  offset: number = 0
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db
    .select({
      id: sales.id,
      notaFiscal: sales.notaFiscal,
      pedidoNumber: sales.pedidoNumber,
      totalValue: sales.totalValue,
      finalValue: sales.finalValue,
      volumeSacos: sales.volumeSacos,
      volumeKg: sales.volumeKg,
      margemBrutaPercent: sales.margemBrutaPercent,
      margemBrutaValor: sales.margemBrutaValor,
      margemLiquidaPercent: sales.margemLiquidaPercent,
      margemLiquidaValor: sales.margemLiquidaValor,
      mesAno: sales.mesAno,
      ano: sales.ano,
      saleDate: sales.saleDate,
      notes: sales.notes,
    })
    .from(sales)
    .where(eq(sales.companyId, companyId))
    .limit(limit)
    .offset(offset);

  if (filtros.mesAno) {
    query = query.where(eq(sales.mesAno, filtros.mesAno)) as any;
  }
  if (filtros.ano) {
    query = query.where(eq(sales.ano, filtros.ano)) as any;
  }
  if (filtros.clienteId) {
    query = query.where(eq(sales.clientId, filtros.clienteId)) as any;
  }
  if (filtros.representante) {
    query = query.where(sql`${sales.notes} ILIKE ${`%${filtros.representante}%`}`) as any;
  }

  return await query;
}
