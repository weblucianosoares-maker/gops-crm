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
    'Amil': 260, 'Bradesco': 300, 'Assim': 260, 'Hapvida': 260, 'SulAmérica': 260, 'Porto Saúde': 260, 'Klini': 180, 'Unimed': 120, 'Cemeru': 100, 'Hsmed': 140, 'Integral': 240, 'Leve': 100, 'MédSênior': 125, 'Nova': 240
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

export const calculateNetCommission = (carrierName: string, monthlyFee: number, tier: TierName, type: 'PF' | 'PJ' = 'PF', lives: number = 1) => {
  // 1. Carregar Configurações de Bônus e Parcelas do localStorage
  let customRules = {
    pme: { first_parcel: 100, second_parcel: 100, bonus_per_life: 0, anticipation_allowed: true },
    adesao: { first_parcel: 100, bonus_on_first_paid: 0, bonus_per_life: 0 }
  };
  
  try {
    const saved = localStorage.getItem('efraim_commission_rules');
    if (saved) customRules = JSON.parse(saved);
  } catch (e) {}

  // 2. Encontrar a Regra da Pedra para a Operadora
  const carrierKey = Object.keys(CARRIER_RE_RULES[tier]).find(k => 
    carrierName.toLowerCase().includes(k.toLowerCase())
  );

  // Percentual total definido pela "Pedra" (ex: 200, 240, 300)
  const totalPercentage = carrierKey ? CARRIER_RE_RULES[tier][carrierKey] : 100;
  const taxRate = carrierKey ? (CARRIER_TAXES[carrierKey] || 0) : 0;
  
  let installments: number[] = [];
  let totalBonus = 0;

  // 3. Distribuir o percentual da Pedra nas parcelas conforme o tipo
  if (type === 'PJ') {
    // Para PME, geralmente as duas primeiras são 100%
    // Ex: 240% -> 100% (1ª), 100% (2ª), 40% (3ª)
    let remaining = totalPercentage;
    
    // 1ª Parcela (usando base configurada ou 100%)
    const p1 = Math.min(remaining, customRules.pme.first_parcel || 100);
    installments.push(p1 / 100);
    remaining -= p1;

    // 2ª Parcela
    const p2 = Math.min(remaining, customRules.pme.second_parcel || 100);
    installments.push(p2 / 100);
    remaining -= p2;

    // 3ª Parcela (Sobra se houver, ex: Bradesco Ouro 240% -> sobra 40%)
    if (remaining > 0) {
      installments.push(remaining / 100);
    }

    totalBonus = (customRules.pme.bonus_per_life || 0) * lives;
  } else {
    // Para Adesão
    let remaining = totalPercentage;
    
    // Angariação
    const p1 = Math.min(remaining, customRules.adesao.first_parcel || 100);
    installments.push(p1 / 100);
    remaining -= p1;

    // Bônus/Resíduo
    if (remaining > 0) {
      installments.push(remaining / 100);
    }
    
    totalBonus = (customRules.adesao.bonus_per_life || 0) * lives;
  }

  // 4. Calcular Valores Finais e Parcelas Detalhadas
  const grossValue = (monthlyFee * (totalPercentage / 100)) + totalBonus;
  const netValue = grossValue * (1 - taxRate);

  const detailedInstallments = installments.map((p, i) => {
    let description = `${i + 1}ª Parcela`;
    let isDirect = false;

    if (type === 'PF' && i === 0) {
      description = "Taxa Angariação (Direto)";
      isDirect = true;
    } else if (type === 'PJ' && i === 1 && carrierName.toLowerCase().includes('united')) {
      description = "2ª Parcela (Antecipável)";
    } else if (carrierName.toLowerCase().includes('leve')) {
      description = "Repasse 100% Operadora";
    }

    return {
      index: i + 1,
      amount: monthlyFee * p,
      netAmount: (monthlyFee * p) * (1 - taxRate),
      description,
      isDirect,
      // Mês relativo ao início da vigência (0 = mês de início, 1 = mês seguinte, etc.)
      relativeMonth: i 
    };
  });

  return {
    gross: grossValue,
    net: netValue,
    taxAmount: grossValue * taxRate,
    percentage: totalPercentage,
    installments: detailedInstallments,
    bonus: totalBonus
  };
};
