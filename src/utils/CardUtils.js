import { VALUES } from "../constants.js";

export function getCardValue(faceKey) {
  if (!faceKey) return null;
  const idx = faceKey.indexOf("_of_");
  if (idx === -1) return null;
  return { value: faceKey.slice(0, idx), suit: faceKey.slice(idx + 4) };
}

/**
 * Check if draggedCard can be placed on a foundation card.
 * direction: +1 = ace foundation (ascending A -> K)
 *            -1 = king foundation (descending K -> A)
 */
export function canPlaceOnFoundation(draggedCard, targetCard, direction) {
  const dragged = getCardValue(draggedCard.faceKey);
  const target  = getCardValue(targetCard.texture.key);
  if (!dragged || !target) return false;
  if (dragged.suit !== target.suit) return false;
  return VALUES.indexOf(dragged.value) === VALUES.indexOf(target.value) + direction;
}

/**
 * Check if draggedCard can be placed on targetCard in the tableau.
 * Same suit, adjacent rank (±1) — including wrap-around Ace ↔ King.
 */
export function canPlaceOnTableau(draggedCard, targetCard) {
  const dragged = getCardValue(draggedCard.faceKey);
  const target  = getCardValue(targetCard.faceKey);
  if (!dragged || !target) return false;
  if (dragged.suit !== target.suit) return false;
  const diff = Math.abs(VALUES.indexOf(dragged.value) - VALUES.indexOf(target.value));
  return diff === 1 || diff === VALUES.length - 1; // ±1 or A↔K wrap-around
}

/**
 * Returns true if at least one valid move exists for the given top cards + foundations.
 */
export function hasAnyMove(topCards, aceRow, kingRow) {
  for (const card of topCards) {
    for (const ace of aceRow) {
      if (canPlaceOnFoundation(card, ace, 1)) return true;
    }
    for (const king of kingRow) {
      if (canPlaceOnFoundation(card, king, -1)) return true;
    }
    for (const target of topCards) {
      if (target !== card && canPlaceOnTableau(card, target)) return true;
    }
  }
  return false;
}
