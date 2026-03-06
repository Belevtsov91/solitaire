export const SUITS  = ["hearts", "diamonds", "clubs", "spades"];
export const VALUES = [
  "ace", "2", "3", "4", "5", "6", "7",
  "8", "9", "10", "jack", "queen", "king",
];

export const CARD_SCALE       = 0.315;
export const CARD_SCALE_DRAG  = 0.35;
export const STACK_OFFSET_Y   = 15;
export const CARD_COL_WIDTH   = 64;
export const FOUNDATION_SPACING = 77;
export const MAX_SHUFFLES     = 3;

// Depth helpers
export const DEPTH_TABLEAU    = (stackId, index) => stackId * 10 + index;
export const DEPTH_FOUNDATION = 500;
export const DEPTH_DRAG       = 1000;
export const DEPTH_UI         = 2000;
