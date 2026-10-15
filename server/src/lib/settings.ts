import type { Settings } from "../../../src/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  platformName: "Wait? Kyu?",
  supportEmail: "support@waitkyu.test",
  announcement: "",
  requireApproval: false,
  allowSignups: true,
  busyThresholdMin: 20,
  // Transparent ranking: relevance is ONLY these text-match weights (no paid placement, no hidden boosts).
  rankingWeights: { name: 100, category: 60, categoryKeyword: 30, service: 40, area: 25, description: 10 },
};
