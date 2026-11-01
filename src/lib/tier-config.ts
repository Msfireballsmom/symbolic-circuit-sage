// Stripe tier configuration — maps price IDs to tier metadata
export const TIERS = {
  basic: {
    name: "Basic",
    price: "$7.99",
    priceAmount: 7.99,
    interval: "mo",
    price_id: "price_1TCEyhBPtYqfoYvYjDVUjepa",
    product_id: "prod_UAa8QX35lkSb2I",
    solvesPerDay: 5,
    description: "",
    features: [
      "Reference sheet",
      "Step-by-step solutions",
    ],
    excluded: [],
  },
  student: {
    name: "Student",
    price: "$11.99",
    priceAmount: 11.99,
    interval: "mo",
    price_id: "price_1TCF1eBPtYqfoYvY2zbc9U7H",
    product_id: "prod_UAaCKVatrLWJsX",
    solvesPerDay: Infinity,
    description: "",
    features: [
      "DC nodal analysis",
      "First-order RC/RL transients",
      "Second-order RLC",
      "Step-by-step solutions",
      "Browser-local saved problems",
    ],
    excluded: [],
  },
  pro: {
    name: "Pro",
    price: "$15.99",
    priceAmount: 15.99,
    interval: "mo",
    price_id: "price_1TCF4JBPtYqfoYvYSG8WimhF",
    product_id: "prod_UAaEzyix3hg4pW",
    solvesPerDay: Infinity,
    popular: true,
    description: "",
    features: [
      "DC nodal analysis",
      "First-order RC/RL transients",
      "Second-order RLC",
      "Step-by-step solutions",
      "Browser-local saved problems",
      "Snap & Solve — confirmed text only",
      "PDF export — full step-by-step derivation",
    ],
    excluded: [],
  },
  team: {
    name: "Team",
    price: "$89.99",
    priceAmount: 89.99,
    interval: "mo",
    price_id: "price_1TCF6CBPtYqfoYvYJz7gMASv",
    product_id: "prod_UAaGOQMSCoEtWs",
    solvesPerDay: Infinity,
    description: "",
    features: [],
    excluded: [],
  },
} as const;

export type TierKey = keyof typeof TIERS;

// Map price_id → tier key
export const PRICE_TO_TIER: Record<string, TierKey> = Object.fromEntries(
  Object.entries(TIERS).map(([key, tier]) => [tier.price_id, key as TierKey])
) as Record<string, TierKey>;

// Map product_id → tier key
export const PRODUCT_TO_TIER: Record<string, TierKey> = Object.fromEntries(
  Object.entries(TIERS).map(([key, tier]) => [tier.product_id, key as TierKey])
) as Record<string, TierKey>;

// Feature access by tier
export const TIER_ACCESS = {
  guest: { solves: 1, lifetime: true },
  free: { solves: 0 },
  basic: { solves: 5 },
  student: { solves: Infinity },
  pro: { solves: Infinity },
  team: { solves: Infinity },
} as const;

// Which tabs are gated by which minimum tier
export const TAB_TIER_REQUIREMENTS: Record<string, TierKey> = {
  quick: "basic",
  dc: "student",
  mesh: "student",
  transient: "student",
  rlc: "student",
  ac: "student",
  laplace: "pro",
  fourier: "pro",
  bode: "pro",
  sage: "pro",
  exam: "student",
  homework: "pro",
  saved: "student",
};

// Tier hierarchy for comparison
const TIER_ORDER: TierKey[] = ["basic", "student", "pro", "team"];

export function tierMeetsRequirement(userTier: TierKey | "free" | null, requiredTier: TierKey): boolean {
  if (!userTier || userTier === "free") return false;
  const userIdx = TIER_ORDER.indexOf(userTier as TierKey);
  const reqIdx = TIER_ORDER.indexOf(requiredTier);
  if (userIdx === -1) return false;
  return userIdx >= reqIdx;
}
