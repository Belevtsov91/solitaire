import { SUITS, VALUES } from "../constants.js";

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generates a shuffled deck of 96 cards (2x full decks minus one ace + one king per suit).
 * The 8 removed cards go to the foundation slots.
 */
export function generateMainDeck() {
  const deck = [];
  for (let n = 0; n < 2; n++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        deck.push(`${value}_of_${suit}`);
      }
    }
  }
  for (const suit of SUITS) {
    let i = deck.indexOf(`ace_of_${suit}`);
    if (i > -1) deck.splice(i, 1);
    i = deck.indexOf(`king_of_${suit}`);
    if (i > -1) deck.splice(i, 1);
  }
  return shuffle(deck); // 96 cards
}
