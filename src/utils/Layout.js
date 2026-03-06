/**
 * Computes the full game layout based on the current screen dimensions.
 *
 * Reference: at 1024 px wide, tableau = 16 × 64 px columns, card scale = 0.315.
 */

const ORIG_CARD_W = 226;
const ORIG_CARD_H = 314;
const REF_COL_W   = 64;
const REF_SCALE   = 0.315;

export function computeLayout(screenW, screenH) {

  // ── Horizontal ──────────────────────────────────────────────────────────

  const availW       = screenW * 0.94;        // 3 % padding each side
  const cardColWidth = availW / 16;
  const cardScale    = (cardColWidth / REF_COL_W) * REF_SCALE;
  const cardW        = ORIG_CARD_W * cardScale;
  const cardH        = ORIG_CARD_H * cardScale;
  const cardScaleDrag = cardScale * 1.11;
  const stackOffY    = Math.max(8, cardH * 0.13);

  // ── UI bar heights ──────────────────────────────────────────────────────

  const topBarH = Math.max(44, screenH * 0.07);

  // Compute btmBarH → btnFontSize in two passes to break the circular dep.
  const rawBtmH     = Math.max(60, screenH * 0.10);
  const btnFontSize = Math.round(Math.min(46, rawBtmH * 0.56));
  // Guarantee the bar is tall enough to fully contain the emoji + label
  const btmBarH     = Math.max(rawBtmH, Math.ceil(btnFontSize * 2.0));

  // ── Vertical content distribution ────────────────────────────────────────
  //
  //  Layout (top → bottom):
  //    topPad  |  gap  row1  gap  row2  gap  row3  gap  found  |  topPad
  //            ↑                                               ↑
  //       topBarH                                          btmBarH

  const availH   = screenH - topBarH - btmBarH;
  const blockH   = cardH + 2 * stackOffY;   // visual height of one 3-card stack
  const contentH = 3 * blockH + cardH;      // 3 tableau rows + 1 foundation row

  // Cap the inter-row gap so rows don't drift apart on tall screens
  const naturalGap = Math.max(0, (availH - contentH) / 4);
  const gap         = Math.min(naturalGap, Math.max(cardH * 0.30, 14));

  // Center the whole content block vertically within availH
  const totalUsed = contentH + 4 * gap;
  const topPad    = Math.max(0, (availH - totalUsed) / 2);

  // rowY = Y of the FIRST (top) card of each tableau row
  const rowY = [
    topBarH + topPad + gap,
    topBarH + topPad + 2 * gap + blockH,
    topBarH + topPad + 3 * gap + 2 * blockH,
  ];

  // Y-centre of foundation cards
  const foundY = topBarH + topPad + 4 * gap + 3 * blockH + cardH / 2;

  // ── Foundation X positions ───────────────────────────────────────────────

  const cx           = screenW / 2;
  const foundSpacing = Math.max(cardColWidth * 1.05, cardW * 1.08);
  const tableauHalf  = 8 * cardColWidth;
  const sideSpace    = cx - tableauHalf;

  let aceStartX, kingStartX;

  if (sideSpace >= 4 * foundSpacing + 8) {
    // Wide screen: foundations flank the tableau left and right
    const groupHalf = 1.5 * foundSpacing;
    aceStartX  = sideSpace / 2 - groupHalf;
    kingStartX = cx + tableauHalf + sideSpace / 2 - groupHalf;
  } else {
    // Narrow screen: both groups centred below the tableau
    const groupGap    = foundSpacing * 0.6;
    const totalFoundW = 3 * foundSpacing + groupGap + 3 * foundSpacing;
    aceStartX  = cx - totalFoundW / 2;
    kingStartX = aceStartX + 3 * foundSpacing + groupGap;
  }

  // ── UI positions ────────────────────────────────────────────────────────

  // Extra 6 px safety margin so emoji descenders are never clipped
  const btnY    = screenH - btmBarH / 2 - 6;
  const topBtnY = topBarH / 2;

  const textFontSize  = Math.round(Math.min(20, topBarH  * 0.40));
  const labelFontSize = Math.round(Math.min(14, btmBarH  * 0.26));

  // Column stride per row:
  //   row 1 — 16 stacks × 1× → full tableau width
  //   row 2 — 8 stacks  × 2× → same total width, stacks further apart (looks balanced)
  //   row 3 — 8 stacks  × 2× → same
  const rowColWidths = [cardColWidth, cardColWidth * 2, cardColWidth * 2];

  return {
    // Card metrics
    cardScale, cardScaleDrag, cardColWidth, cardW, cardH, stackOffY,

    // Row layout
    rowY, rowColWidths, foundY, foundSpacing, aceStartX, kingStartX,

    // UI zones
    topBarH, btmBarH, btnY, topBtnY,
    btnFontSize, textFontSize, labelFontSize,

    // Convenience
    cx, cy: screenH / 2, w: screenW, h: screenH,
  };
}
