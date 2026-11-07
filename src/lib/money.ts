/** Money formatting. Manual rather than Intl so output is identical on Hermes, web and Node. */

function groupThousands(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** $1,234.50 (or $1,235 when whole=true). Negative values get a leading minus. */
export function formatMoney(amount: number, whole = false): string {
  const abs = Math.abs(amount);
  const [int, dec] = (whole ? Math.round(abs).toString() : abs.toFixed(2)).split('.');
  const body = `$${groupThousands(int)}${dec ? `.${dec}` : ''}`;
  return amount < 0 && (whole ? Math.round(abs) : abs) !== 0 ? `−${body}` : body;
}

/** +$12.00 / −$12.00, for transaction lists. */
export function formatSigned(amount: number, whole = false): string {
  const s = formatMoney(Math.abs(amount), whole);
  return amount < 0 ? `−${s}` : `+${s}`;
}

/** $12.6k, for tight spaces like chart labels. */
export function formatCompact(amount: number): string {
  if (Math.abs(amount) >= 1000) {
    const k = amount / 1000;
    return `$${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return formatMoney(amount, true);
}

export const roundCents = (n: number) => Math.round(n * 100) / 100;

export const formatPercent = (rate: number, dp = 2) => `${(rate * 100).toFixed(dp)}%`;
