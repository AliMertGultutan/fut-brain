export type PlayerPosition =
  | 'GK'
  | 'LB'
  | 'CB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'LF'
  | 'RF'
  | 'ST'
  | 'CF';

export type PriceStatus = 'LIVE' | 'CACHED' | 'STALE' | 'DEMO' | 'MANUAL' | 'UNAVAILABLE';

export interface PlayerStats {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface Player {
  id: string;
  futbinId?: string;
  gameYear?: '26' | '27';
  pricePlatform?: 'pc' | 'ps' | 'xbox';
  priceObservedAt?: string;
  cardVersion?: string;
  basePlayerId?: string;
  name: string;
  commonName: string;
  rating: number;
  position: PlayerPosition;
  secondaryPositions?: PlayerPosition[];
  league: string;
  nation: string;
  nationCode: string;
  club: string;
  clubCode: string;
  cardType: 'GOLD_RARE' | 'BASE' | 'TOTW' | 'CENTURIONS' | 'FLASHBACK' | 'RTTF' | 'POTM' | 'ICON' | 'HERO' | 'SPECIAL';
  isSpecial: boolean;
  isUntradeable: boolean;
  isDuplicate?: boolean;
  inClub: boolean;
  price: number;
  priceSource: string;
  priceStatus: PriceStatus;
  priceUpdatedAt: string;
  stats: PlayerStats;
  statsKnown?: boolean;
  playStyles: string[];
  playStylesKnown?: boolean;
  positionsKnown?: boolean;
  imageUrl?: string;
  shellUrl?: string;
  detailedStats?: Record<string, number>;
  playStyleDetails?: { id: number; name: string; isPlus: boolean; description: string | null }[];
  matchesPlayed?: number;
  goalsScored?: number;
  assists?: number;
}

export interface SbcRequirement {
  playerCount: number;
  minSquadRating: number;
  minTotw?: number;
  minSpecial?: number;
  maxPerClub?: number;
  maxPerLeague?: number;
  maxPerNation?: number;
  minSameClub?: number;
  minClubs?: number;
  maxClubs?: number;
  maxNations?: number;
  maxLeagues?: number;
  minNations?: number;
  minLeagues?: number;
  minChemistry?: number;
  exactLeague?: string;
  exactNation?: string;
  exactClub?: string;
  minSameNation?: number;
  minSameLeague?: number;
}

export interface SbcChallenge {
  id: string;
  source?: 'DEMO' | 'MANUAL' | 'PARSE';
  gameYear?: '26' | '27';
  sourceUrl?: string;
  sourceFetchedAt?: string;
  rawRequirements?: string[];
  expiresText?: string;
  name: string;
  group: string;
  segmentTitle: string;
  segmentIndex: number;
  segmentTotal: number;
  expiresDays: number;
  requirements: SbcRequirement;
  rewardTitle: string;
  rewardValueEstimated: number;
  marketPriceBench: number;
  tokenRules?: {
    allowedRatings: number[];
    chemistry: number;
    fragmentCost: number;
    fragmentTokenRating: 87 | 88 | 89;
    source: 'DEMO' | 'MANUAL';
  };
}

export interface SbcSlot {
  slotId: string;
  position: PlayerPosition;
  player: Player | null;
  isFromClub: boolean;
  isUntradeable: boolean;
  isToken: boolean;
  tokenRating?: number;
  tokenLabel?: string;
  cost: number;
  lockInSolution?: boolean;
  chemistry?: number; // 0, 1, 2, 3
  isPositionMatch?: boolean;
  alternativePlayers?: Player[];
}

export type SolverStrategy = 'CHEAPEST' | 'CLUB_FIRST' | 'TOKEN_OPTIMIZED' | 'MAX_CHEM';

export interface SbcChecklistItem {
  id: string;
  label: string;
  current: string;
  required: string;
  satisfied: boolean;
}

export interface SbcSolution {
  challengeId: string;
  challengeName: string;
  mode: 'CLUB_TOKEN' | 'NORMAL';
  strategyUsed: SolverStrategy;
  formation: string;
  slots: SbcSlot[];
  totalCoinCost: number;
  untradeableValueUsed: number;
  clubPlayersCount: number;
  marketPlayersCount: number;
  tokensCount: number;
  tokensUsed: string[];
  effectiveRating: number;
  requiredRating: number;
  ratingDelta: number;
  rawRatingSum: number;
  requiredRawSum: number;
  totalChemistry: number;
  requiredChemistry: number;
  isFeasible: boolean;
  satisfiesTotw: boolean;
  unmetRequirements: string[];
  requirementChecklist: SbcChecklistItem[];
  savingsPercent: number;
  solveTimeMs: number;
  searchStatus: 'OPTIMAL' | 'FEASIBLE' | 'LIMIT_REACHED' | 'NO_SOLUTION' | 'INVALID_INPUT';
  searchedNodes: number;
  warnings: string[];
  dataStatus: 'DEMO' | 'MANUAL' | 'PARSE' | 'MIXED' | 'UNAVAILABLE';
  tokenUsage: Record<string, number>;
  missingPriceCount: number;
}

export interface TokenInventory {
  tokens89Plus: number;
  tokens88Plus: number;
  tokens87Plus: number;
  fragments: number;
}

export interface MarketTrend {
  id: string;
  playerId: string;
  name: string;
  rating: number;
  position: PlayerPosition;
  club: string;
  league: string;
  price: number;
  deltaPercent: number;
  chemPoints: number;
  sparkline: number[];
}

export interface ClubActivity {
  id: string;
  type: 'PACK' | 'EVO' | 'SBC';
  title: string;
  description: string;
  timeAgo: string;
}

export interface EvolutionLevel {
  levelNumber: number;
  title: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  statBoostSummary: string;
  specialRewardBadge?: string;
  objectiveText: string;
  currentProgress: number;
  targetProgress: number;
}

export interface EvolutionProgram {
  id: string;
  name: string;
  tagline: string;
  costType: 'FREE' | 'COINS';
  costCoins: number;
  expiresDays: number;
  maxBaseRating: number;
  activeSlotInfo: string;
  candidateIds: string[];
  levels: EvolutionLevel[];
  expertTip: string;
}

export interface AppSettings {
  platform: 'PC_WEBAPP' | 'PLAYSTATION' | 'XBOX';
  dataSourceMode: 'DEMO' | 'MANUAL';
  currencyFormat: 'COINS' | 'COMPACT';
  defaultSbcMode: 'CLUB_TOKEN' | 'NORMAL';
  prioritizeUntradeables: boolean;
  includeTokens: boolean;
  lastSyncTime: string;
  marketApiStatus: 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';
}
