import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatCPF(value: string | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .substring(0, 14);
}

export function formatPhone(value: string | undefined) {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.substring(2);
  }

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 14);
  }
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .substring(0, 15);
}

export function formatCNPJ(value: string | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
    .substring(0, 18);
}

export function formatCEP(value: string | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits
    .replace(/(\d{5})(\d)/, "$1-$2")
    .substring(0, 9);
}

export function formatCurrencyValue(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return "";
  
  // Convert to string and keep only digits
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  
  const amount = parseInt(digits) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCurrencyValue(value: string): number {
  if (!value) return 0;
  const digits = value.replace(/\D/g, "");
  return digits ? parseInt(digits) / 100 : 0;
}

export function formatDateTime(value: string | Date | undefined) {
  if (!value) return "---";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
