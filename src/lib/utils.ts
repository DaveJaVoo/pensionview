
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseCurrency(value: string | undefined | number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (value.trim() === "" || value.toLowerCase() === "no tax" || value.toLowerCase() === "-") return undefined;
  
  const numericValue = parseFloat(value.replace(/[^0-9.-]+/g,""));
  return isNaN(numericValue) ? undefined : numericValue;
}

export function formatCurrency(value: number | undefined | string, showSymbol: boolean = true): string {
  if (value === undefined || value === null) return "-";
  
  let numValue: number;
  if (typeof value === 'string') {
    if (value.toLowerCase() === "no tax") return "No Tax";
    const parsed = parseCurrency(value);
    if (parsed === undefined) return value; // Return original string if not parsable as currency (e.g. "NO TAX")
    numValue = parsed;
  } else {
    numValue = value;
  }

  const symbol = showSymbol ? "£" : "";
  return `${symbol}${numValue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function parsePercentage(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = parseFloat(value.replace('%', ''));
  return isNaN(num) ? undefined : num;
}

