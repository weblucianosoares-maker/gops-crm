// Regras de Comissionamento United Planos de Saúde & Invictos 2026

export type TierName = 'Interno' | 'Ouro' | 'Safira' | 'Esmeralda' | 'Diamante' | 'Brilhante' | 'Rubi';

export interface TierConfig {
  name: TierName;
  minVgv: number;
  label: string;
  color: string;
}

export const TIERS: TierConfig[] = [
  { name: 'Interno', minVgv: 0, label: 'Corretor Interno', color: 'slate' },
  { name: 'Ouro', minVgv: 10000, label: 'Pedra Ouro', color: 'amber' },
  { name: 'Safira', minVgv: 15000, label: 'Pedra Safira', color: 'blue' },
  { name: 'Esmeralda', minVgv: 20000, label: 'Pedra Esmeralda', color: 'emerald' },
  { name: 'Diamante', minVgv: 30000, label: 'Pedra Diamante', color: 'cyan' },
  { name: 'Brilhante', minVgv: 40000, label: 'Pedra Brilhante', color: 'sky' },
  { name: 'Rubi', minVgv: 50000, label: 'Pedra Rubi', color: 'red' },
];

export interface CarrierCommission {
  total: number;
  installments: number[]; // e.g. [1.0, 0.8, 0.2]
  taxRate: number; // e.g. 0.0476 for 4.76%
}

// Percentuais totais por operadora em cada Grade (PME/Empresarial)
const CARRIER_RE_RULES: Record<TierName, Record<string, number>> = {
  Interno: {
    'Amil': 200, 'Bradesco': 240, 'Assim': 200, 'Hapvida': 200, 'SulAmérica': 200, 'Porto Saúde': 200, 'Klini': 180, 'Unimed': 100, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 180, 'Leve': 150, 'MédSênior': 125, 'Nova': 180
  },
  Ouro: {
    'Amil': 210, 'Bradesco': 250, 'Assim': 210, 'Hapvida': 210, 'SulAmérica': 210, 'Porto Saúde': 210, 'Klini': 180, 'Unimed': 100, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 180, 'Leve': 150, 'MédSênior': 125, 'Nova': 180
  },
  Safira: {
    'Amil': 220, 'Bradesco': 260, 'Assim': 220, 'Hapvida': 220, 'SulAmérica': 220, 'Porto Saúde': 220, 'Klini': 180, 'Unimed': 100, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 180, 'Leve': 150, 'MédSênior': 125, 'Nova': 180
  },
  Esmeralda: {
    'Amil': 230, 'Bradesco': 270, 'Assim': 230, 'Hapvida': 230, 'SulAmérica': 230, 'Porto Saúde': 230, 'Klini': 180, 'Unimed': 100, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 180, 'Leve': 150, 'MédSênior': 125, 'Nova': 180
  },
  Diamante: {
    'Amil': 240, 'Bradesco': 280, 'Assim': 240, 'Hapvida': 240, 'SulAmérica': 240, 'Porto Saúde': 240, 'Klini': 180, 'Unimed': 100, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 220, 'Leve': 150, 'MédSênior': 125, 'Nova': 180
  },
  Brilhante: {
    'Amil': 250, 'Bradesco': 290, 'Assim': 250, 'Hapvida': 250, 'SulAmérica': 250, 'Porto Saúde': 250, 'Klini': 180, 'Unimed': 100, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 220, 'Leve': 150, 'MédSênior': 125, 'Nova': 180
  },
  Rubi: {
    'Amil': 260, 'Bradesco': 300, 'Assim': 260, 'Hapvida': 260, 'SulAmérica': 260, 'Porto Saúde': 260, 'Klini': 180, 'Unimed': 120, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 240, 'Leve': 180, 'MédSênior': 125, 'Nova': 240
  }
};

const CARRIER_TAXES: Record<string, number> = {
  'Assim': 0.0476,
  'Hapvida': 0.0665,
  'Klini': 0.0965,
};

export const getTier = (vgv: number): TierConfig => {
  return [...TIERS].reverse().find(t => vgv >= t.minVgv) || TIERS[0];
};

export const calculateNetCommission = (carrierName: string, monthlyFee: number, tier: TierName) => {
  // Encontra a operadora (normaliza nome para bater com a regra)
  const carrierKey = Object.keys(CARRIER_RE_RULES[tier]).find(k => 
    carrierName.toLowerCase().includes(k.toLowerCase())
  );

  if (!carrierKey) {
    const fallbackGross = monthlyFee * 0.1;
    return {
      gross: fallbackGross,
      net: fallbackGross,
      taxAmount: 0,
      percentage: 10
    };
  }

  const basePercentage = CARRIER_RE_RULES[tier][carrierKey] / 100;
  const grossValue = monthlyFee * basePercentage;
  
  const taxRate = CARRIER_TAXES[carrierKey] || 0;
  const netValue = grossValue * (1 - taxRate);

  return {
    gross: grossValue,
    net: netValue,
    taxAmount: grossValue * taxRate,
    percentage: CARRIER_RE_RULES[tier][carrierKey]
  };
};
