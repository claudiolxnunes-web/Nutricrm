// Funções para formatação de data no padrão brasileiro

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR");
}

export function formatCurrencyBR(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Converte data do formato ISO (YYYY-MM-DD) para exibição BR (DD/MM/YYYY)
export function isoToBR(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

// Converte data do formato BR (DD/MM/YYYY) para ISO (YYYY-MM-DD)
export function brToISO(brDate: string): string {
  if (!brDate) return "";
  const [day, month, year] = brDate.split("/");
  if (!day || !month || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

// Obtém data atual no formato BR
export function getTodayBR(): string {
  return new Date().toLocaleDateString("pt-BR");
}

// Obtém data atual no formato ISO (para inputs)
export function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}
