import Phaser from "phaser";
import {
  SUITS,
  DEPTH_TABLEAU, DEPTH_FOUNDATION, DEPTH_DRAG, DEPTH_UI,
  MAX_SHUFFLES,
} from "../constants.js";
import { computeLayout } from "../utils/Layout.js";
import { generateMainDeck } from "../utils/Deck.js";
import { canPlaceOnFoundation, canPlaceOnTableau, hasAnyMove } from "../utils/CardUtils.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create() {
    this.initState();
    this.dealCards();
    this.createFoundations();
    this.setupInput();
    this.createUI();
    this.setupTimer();

    // Restart scene on window resize (debounced 300 ms).
    // Store handler reference so it can be removed on shutdown (prevents listener leak).
    this._onResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        if (this.scene.isActive("GameScene")) this.scene.restart();
      }, 300);
    };
    this.scale.on("resize", this._onResize, this);
    this.events.on("shutdown", () => {
      clearTimeout(this._resizeTimer);
      this.scale.off("resize", this._onResize, this);
    });
  }

  // ─── State ────────────────────────────────────────────────────────────────

  initState() {
    this.layout          = computeLayout(this.scale.width, this.scale.height);
    this.soundEnabled    = true;
    this.shuffleCount    = 0;
    this.score           = 0;
    this.elapsed         = 0;
    this.gameWon         = false;
    this.gameOver        = false;
    this.cards           = [];
    this.aceRow          = [];
    this.kingRow         = [];
    this.draggedSequence = null;
    this.undoStack       = [];
    this.deckIndex       = 0;
    this.mainDeck        = generateMainDeck();
    this._gameOverObjs   = [];
  }

  // ─── Deal ─────────────────────────────────────────────────────────────────

  dealCards() {
    const { cx, rowY, rowColWidths } = this.layout;
    this.createRow(cx, rowY[0], 16,  0, rowColWidths[0]);
    this.createRow(cx, rowY[1],  8, 16, rowColWidths[1]);
    this.createRow(cx, rowY[2],  8, 24, rowColWidths[2]);
    const stackIds = [...new Set(this.cards.map(c => c.stackId))];
    stackIds.forEach(id => this.refreshDraggableForStack(id));
  }

  createRow(centerX, baseY, total, stackIdOffset, colWidth) {
    const { cardScale, stackOffY } = this.layout;
    const cw = colWidth ?? this.layout.cardColWidth;
    const startX = centerX - (total * cw) / 2;
    for (let i = 0; i < total; i++) {
      const x       = startX + i * cw;
      const stackId = stackIdOffset + i;
      for (let j = 0; j < 3; j++) {
        if (this.deckIndex >= this.mainDeck.length) break;
        const faceKey = this.mainDeck[this.deckIndex++];
        const y       = baseY + j * stackOffY;
        const card    = this.add
          .image(x, y, faceKey)
          .setScale(cardScale)
          .setDepth(DEPTH_TABLEAU(stackId, j));

        card.faceKey    = faceKey;
        card.startX     = x;
        card.startY     = y;
        card.stackId    = stackId;
        card.stackIndex = j;
        card.isFaceUp   = true;
        this.cards.push(card);
      }
    }
  }

  // ─── Foundations ──────────────────────────────────────────────────────────

  createFoundations() {
    const { aceStartX, kingStartX, foundY } = this.layout;
    this.aceRow  = this.buildFoundationRow(aceStartX,  foundY, "ace");
    this.kingRow = this.buildFoundationRow(kingStartX, foundY, "king");
  }

  buildFoundationRow(startX, y, type) {
    const { cardScale, foundSpacing } = this.layout;
    return SUITS.map((suit, i) => {
      const key  = `${type}_of_${suit}`;
      const card = this.add
        .image(startX + i * foundSpacing, y, key)
        .setScale(cardScale)
        .setInteractive()
        .setDepth(DEPTH_FOUNDATION);
      card.cardCount = 1;
      card.faceKey   = key;
      return card;
    });
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  setupInput() {
    this.input.on("dragstart", (_pointer, gameObject) => {
      this.draggedSequence  = [gameObject];
      gameObject.dragStartX = gameObject.x;
      gameObject.dragStartY = gameObject.y;
      gameObject.setDepth(DEPTH_DRAG);
      gameObject.setScale(this.layout.cardScaleDrag);
    });

    this.input.on("drag", (_pointer, gameObject, dragX, dragY) => {
      if (!this.draggedSequence) return;
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on("dragend", (_pointer, gameObject) => {
      this.handleCardDrop(gameObject);
    });

    this.input.keyboard.on("keydown-F", () => this.toggleFullscreen());
    this.input.keyboard.on("keydown-Z", (e) => {
      if (e.ctrlKey || e.metaKey) this.undoMove();
    });
  }

  // ─── UI ───────────────────────────────────────────────────────────────────

  createUI() {
    const { w, btnY, topBtnY, btnFontSize, textFontSize, labelFontSize } = this.layout;
    const bf = `${btnFontSize}px`;
    const tf = `${textFontSize}px`;
    const lf = `${labelFontSize}px`;

    // Safe distance from screen edge so no emoji is clipped
    const pad = btnFontSize * 0.7;

    // ── Top bar ──────────────────────────────────────────────────────────────

    // New Game — anchored to left edge
    this.add.text(pad, topBtnY, "🔄", { fontSize: bf })
      .setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.scene.restart());

    // Score — left of center, after new-game button
    this.scoreText = this.add
      .text(pad * 2.2, topBtnY, "Очки: 0", { fontSize: tf, color: "#FFD700" })
      .setOrigin(0, 0.5).setDepth(DEPTH_UI);

    // Timer — anchored to right edge
    this.timerText = this.add
      .text(w - pad * 0.4, topBtnY, "00:00", { fontSize: tf, color: "#ffffff" })
      .setOrigin(1, 0.5).setDepth(DEPTH_UI);

    // ── Bottom bar ───────────────────────────────────────────────────────────

    // Hint — left edge
    this.add.text(pad, btnY, "💡", { fontSize: bf })
      .setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.showHint());

    // Undo — left, next to hint (also Ctrl+Z)
    this.add.text(pad * 2.5, btnY, "↩️", { fontSize: bf })
      .setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.undoMove());

    // Shuffle + counter — center
    this.shuffleBtn = this.add.text(w / 2, btnY, "🔀", { fontSize: bf })
      .setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.shuffleCrescent());

    this.shuffleText = this.add
      .text(w / 2, btnY + btnFontSize * 0.72, `${this.shuffleCount}/${MAX_SHUFFLES}`, {
        fontSize: lf, color: "#cccccc",
      })
      .setOrigin(0.5).setDepth(DEPTH_UI);

    // Sound — right side, before fullscreen
    this.soundBtn = this.add.text(w - pad * 2.5, btnY, "🔊", { fontSize: bf })
      .setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.toggleSound());

    // Fullscreen — right edge
    this.add.text(w - pad, btnY, "⛶", { fontSize: bf })
      .setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.toggleFullscreen());
  }

  setupTimer() {
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameOver || this.gameWon) return;
        this.elapsed++;
        const m = String(Math.floor(this.elapsed / 60)).padStart(2, "0");
        const s = String(this.elapsed % 60).padStart(2, "0");
        this.timerText.setText(`${m}:${s}`);
      },
    });
  }

  // ─── Stack helpers ────────────────────────────────────────────────────────

  getStack(stackId) {
    return this.cards
      .filter(c => c.stackId === stackId)
      .sort((a, b) => a.stackIndex - b.stackIndex);
  }

  refreshDraggableForStack(stackId) {
    const stack = this.getStack(stackId);
    stack.forEach(c => { if (c.input) c.disableInteractive(); });
    const top = stack[stack.length - 1];
    if (top) {
      top.setInteractive({ draggable: true });
      this.input.setDraggable(top);
    }
  }

  updateStackIndices(stackId) {
    const stack = this.cards
      .filter(c => c.stackId === stackId)
      .sort((a, b) => a.y - b.y);
    stack.forEach((card, i) => {
      card.stackIndex = i;
      card.setDepth(DEPTH_TABLEAU(stackId, i));
    });
  }

  getTopCards() {
    const tops = new Map();
    this.cards.forEach(c => {
      const prev = tops.get(c.stackId);
      if (!prev || c.stackIndex > prev.stackIndex) tops.set(c.stackId, c);
    });
    return [...tops.values()];
  }

  // ─── Drop logic ───────────────────────────────────────────────────────────

  handleCardDrop(draggedCard) {
    const { cardScale } = this.layout;
    let placed = false;

    // Try foundations (ace ascending, king descending)
    for (const [row, dir] of [[this.aceRow, 1], [this.kingRow, -1]]) {
      if (placed) break;
      for (const fCard of row) {
        const hit = Phaser.Geom.Intersects.RectangleToRectangle(
          draggedCard.getBounds(), fCard.getBounds()
        );
        if (hit && canPlaceOnFoundation(draggedCard, fCard, dir)) {
          this.saveUndoState();
          this.placeCardOnFoundation(draggedCard, fCard);
          placed = true;
          break;
        }
      }
    }

    // Try tableau
    if (!placed) {
      const seq     = this.draggedSequence ?? [];
      const targets = this.getTopCards().filter(
        c => c !== draggedCard && !seq.includes(c)
      );
      for (const target of targets) {
        const hit = Phaser.Geom.Intersects.RectangleToRectangle(
          draggedCard.getBounds(), target.getBounds()
        );
        if (hit && canPlaceOnTableau(draggedCard, target)) {
          this.saveUndoState();
          this.placeCardOnTableau(draggedCard, target);
          placed = true;
          break;
        }
      }
    }

    // Return card to its starting position if no placement was found
    if (!placed && this.draggedSequence) {
      this.draggedSequence.forEach(card => {
        this.tweens.add({
          targets: card, x: card.dragStartX, y: card.dragStartY,
          scaleX: cardScale, scaleY: cardScale,
          duration: 250, ease: "Back.easeOut",
          onComplete: () => card.setDepth(DEPTH_TABLEAU(card.stackId, card.stackIndex)),
        });
      });
    }

    this.draggedSequence = null;
  }

  placeCardOnFoundation(draggedCard, targetCard) {
    const { cardScale } = this.layout;
    if (this.soundEnabled) this.sound.play("cardPlace", { volume: 0.5 });
    const oldStackId = draggedCard.stackId;

    this.tweens.add({
      targets: draggedCard,
      x: targetCard.x, y: targetCard.y,
      scaleX: cardScale, scaleY: cardScale,
      duration: 200, ease: "Sine.easeOut",
      onComplete: () => {
        targetCard.setTexture(draggedCard.faceKey);
        if (!targetCard.cardCount) targetCard.cardCount = 1;
        targetCard.cardCount++;

        draggedCard.destroy();
        const idx = this.cards.indexOf(draggedCard);
        if (idx > -1) this.cards.splice(idx, 1);

        this.updateStackIndices(oldStackId);
        this.refreshDraggableForStack(oldStackId);
        this.addScore(100);
        this.checkWin();
        if (!this.gameWon) this.checkGameOver();
      },
    });

    this.draggedSequence = null;
  }

  placeCardOnTableau(draggedCard, targetCard) {
    const { cardScale, stackOffY } = this.layout;
    if (this.soundEnabled) this.sound.play("cardMove", { volume: 0.3 });

    const oldStackId = draggedCard.stackId;
    const newStackId = targetCard.stackId;
    const baseIndex  = targetCard.stackIndex + 1;
    const seq        = this.draggedSequence ?? [draggedCard];
    let   finished   = 0;

    seq.forEach((card, i) => {
      const newY = targetCard.y + stackOffY * (i + 1);
      this.tweens.add({
        targets: card,
        x: targetCard.x, y: newY,
        scaleX: cardScale, scaleY: cardScale,
        duration: 200, ease: "Sine.easeOut",
        onComplete: () => {
          card.startX     = targetCard.x;
          card.startY     = newY;
          card.stackId    = newStackId;
          card.stackIndex = baseIndex + i;
          card.setDepth(DEPTH_TABLEAU(newStackId, card.stackIndex));

          if (++finished === seq.length) {
            this.updateStackIndices(oldStackId);
            this.updateStackIndices(newStackId);
            this.refreshDraggableForStack(oldStackId);
            this.refreshDraggableForStack(newStackId);
            this.addScore(10);
            this.checkGameOver();
          }
        },
      });
    });

    this.draggedSequence = null;
  }

  // ─── Undo ─────────────────────────────────────────────────────────────────

  saveUndoState() {
    this.undoStack.push({
      cards: this.cards.map(c => ({
        faceKey:    c.faceKey,
        x:          c.startX,
        y:          c.startY,
        startX:     c.startX,
        startY:     c.startY,
        stackId:    c.stackId,
        stackIndex: c.stackIndex,
        depth:      DEPTH_TABLEAU(c.stackId, c.stackIndex),
        textureKey: c.texture.key,
      })),
      aceRow:       this.aceRow.map(f  => ({ cardCount: f.cardCount, textureKey: f.texture.key })),
      kingRow:      this.kingRow.map(f => ({ cardCount: f.cardCount, textureKey: f.texture.key })),
      shuffleCount: this.shuffleCount,
      score:        this.score,
    });
  }

  undoMove() {
    if (this.undoStack.length === 0) return;
    const { cardScale } = this.layout;
    const state = this.undoStack.pop();

    // Destroy current tableau cards and recreate from snapshot
    this.cards.forEach(c => c.destroy());
    this.cards = [];

    state.cards.forEach(cs => {
      const card = this.add
        .image(cs.x, cs.y, cs.textureKey)
        .setScale(cardScale)
        .setDepth(cs.depth);
      card.faceKey    = cs.faceKey;
      card.startX     = cs.startX;
      card.startY     = cs.startY;
      card.stackId    = cs.stackId;
      card.stackIndex = cs.stackIndex;
      card.isFaceUp   = true;
      this.cards.push(card);
    });

    // Restore foundations
    state.aceRow.forEach((fs, i) => {
      this.aceRow[i].cardCount = fs.cardCount;
      this.aceRow[i].setTexture(fs.textureKey);
    });
    state.kingRow.forEach((fs, i) => {
      this.kingRow[i].cardCount = fs.cardCount;
      this.kingRow[i].setTexture(fs.textureKey);
    });

    // Restore counters
    this.shuffleCount = state.shuffleCount;
    this.shuffleText.setText(`${this.shuffleCount}/${MAX_SHUFFLES}`);
    if (this.shuffleCount < MAX_SHUFFLES) {
      this.shuffleBtn.setAlpha(1).setInteractive();
    }

    this.score = state.score;
    this.scoreText.setText(`Очки: ${this.score}`);

    // Re-enable draggable for all restored stacks
    const stackIds = [...new Set(this.cards.map(c => c.stackId))];
    stackIds.forEach(id => this.refreshDraggableForStack(id));

    // Clear game-over / win state and overlay
    this.gameOver = false;
    this.gameWon  = false;
    this._clearGameOverOverlay();
  }

  // ─── Shuffle ──────────────────────────────────────────────────────────────

  shuffleCrescent() {
    if (this.shuffleCount >= MAX_SHUFFLES) return;
    const { stackOffY } = this.layout;
    this.saveUndoState();

    this.shuffleCount++;
    this.shuffleText.setText(`${this.shuffleCount}/${MAX_SHUFFLES}`);
    if (this.soundEnabled) this.sound.play("shuffle", { volume: 0.5 });

    if (this.shuffleCount >= MAX_SHUFFLES) {
      this.shuffleBtn.disableInteractive().setAlpha(0.5);
    }

    const stacks = {};
    this.cards.forEach(card => (stacks[card.stackId] ??= []).push(card));

    Object.entries(stacks).forEach(([stackIdStr, rawStack]) => {
      const stackId = parseInt(stackIdStr, 10);
      const stack   = rawStack.sort((a, b) => a.y - b.y);
      if (stack.length < 2) return;

      const bottom  = stack.shift();
      const baseY   = stack[0].y;
      const newTopY = stack[stack.length - 1].y + stackOffY;

      // Animate the remaining cards shifting down one slot
      stack.forEach((card, idx) => {
        this.tweens.add({
          targets: card, y: baseY + idx * stackOffY,
          duration: 300, ease: "Sine.easeOut",
          onComplete: () => {
            card.startY     = card.y;
            card.stackIndex = idx;
            card.setDepth(DEPTH_TABLEAU(stackId, idx));
          },
        });
      });

      // Animate the bottom card rising to the top
      this.tweens.add({
        targets: bottom, y: newTopY,
        duration: 400, delay: 80, ease: "Back.easeOut",
        onComplete: () => {
          bottom.startY     = newTopY;
          bottom.stackIndex = stack.length;
          bottom.setDepth(DEPTH_TABLEAU(stackId, stack.length));
          this.updateStackIndices(stackId);
          this.refreshDraggableForStack(stackId);
        },
      });
    });

    this.time.delayedCall(600, () => this.checkGameOver());
  }

  // ─── Hint ─────────────────────────────────────────────────────────────────

  showHint() {
    const topCards = this.getTopCards();

    // Foundation moves (highest priority)
    for (const card of topCards) {
      for (const ace of this.aceRow) {
        if (canPlaceOnFoundation(card, ace, 1)) { this.highlightCard(card); this.highlightCard(ace); return; }
      }
      for (const king of this.kingRow) {
        if (canPlaceOnFoundation(card, king, -1)) { this.highlightCard(card); this.highlightCard(king); return; }
      }
    }

    // Tableau moves
    for (const card of topCards) {
      for (const target of topCards) {
        if (target !== card && canPlaceOnTableau(card, target)) {
          this.highlightCard(card);
          this.highlightCard(target);
          return;
        }
      }
    }

    // No move — suggest shuffle
    if (this.shuffleCount < MAX_SHUFFLES) {
      this.highlightCard(this.shuffleBtn);
    }
  }

  highlightCard(obj) {
    this.tweens.killTweensOf(obj);
    const baseScale = (obj === this.shuffleBtn) ? 1 : this.layout.cardScale;
    this.tweens.add({
      targets: obj,
      scaleX: baseScale * 1.25, scaleY: baseScale * 1.25,
      duration: 280, yoyo: true, repeat: 2, ease: "Sine.easeInOut",
      onComplete: () => obj.setScale(baseScale),
    });
  }

  // ─── Score ────────────────────────────────────────────────────────────────

  addScore(delta) {
    this.score += delta;
    this.scoreText.setText(`Очки: ${this.score}`);
  }

  // ─── Win / Game Over ──────────────────────────────────────────────────────

  checkWin() {
    if ([...this.aceRow, ...this.kingRow].every(f => f.cardCount === 13)) {
      this.gameWon = true;
      this.time.delayedCall(500, () => this.playWinAnimation());
    }
  }

  checkGameOver() {
    if (this.gameWon || this.gameOver) return;
    if (hasAnyMove(this.getTopCards(), this.aceRow, this.kingRow)) return;
    if (this.shuffleCount < MAX_SHUFFLES) return;
    this.gameOver = true;
    this.time.delayedCall(400, () => this.showGameOver());
  }

  playWinAnimation() {
    const { cx, cy, w, h } = this.layout;
    if (this.soundEnabled) this.sound.play("win", { volume: 0.7 });

    [...this.aceRow, ...this.kingRow].forEach((card, i) => {
      this.tweens.add({
        targets: card,
        x: cx, y: cy - h * 0.07, rotation: 0, scaleX: 0.5, scaleY: 0.5,
        duration: 800, delay: i * 100, ease: "Back.easeInOut",
      });
    });

    this.time.delayedCall(1200, () => {
      const fs = Math.min(w * 0.06, 80);

      const winText = this.add
        .text(cx, cy + h * 0.06, "ПОБЕДА!", {
          fontSize: `${fs}px`, color: "#FFD700",
          fontStyle: "bold", stroke: "#000000", strokeThickness: 8,
        })
        .setOrigin(0.5).setDepth(DEPTH_UI).setAlpha(0);

      this.tweens.add({
        targets: winText, alpha: 1, scaleX: 1.15, scaleY: 1.15,
        duration: 600, ease: "Bounce.easeOut",
      });

      this.add.text(cx, cy + h * 0.16, `Итог: ${this.score} очков`, {
        fontSize: `${Math.min(fs * 0.45, 36)}px`,
        color: "#ffffff", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(DEPTH_UI);

      this.add.text(cx, cy + h * 0.24, "[ Новая игра ]", {
        fontSize: `${Math.min(fs * 0.4, 30)}px`,
        color: "#00ff88", backgroundColor: "#003322",
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
        .on("pointerdown", () => this.scene.restart());
    });
  }

  showGameOver() {
    const { cx, cy, w, h } = this.layout;
    const fs = Math.min(w * 0.055, 68);

    const add = (obj) => { this._gameOverObjs.push(obj); return obj; };

    add(this.add.rectangle(cx, cy, w, h, 0x000000, 0.65).setDepth(DEPTH_UI - 1));

    add(this.add.text(cx, cy - h * 0.07, "Нет ходов", {
      fontSize: `${fs}px`, color: "#ff4444",
      fontStyle: "bold", stroke: "#000000", strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH_UI));

    add(this.add.text(cx, cy + h * 0.01, `Очки: ${this.score}`, {
      fontSize: `${Math.min(fs * 0.5, 34)}px`, color: "#ffffff",
    }).setOrigin(0.5).setDepth(DEPTH_UI));

    if (this.undoStack.length > 0) {
      add(this.add.text(cx, cy + h * 0.10, "[ Отменить ход ]", {
        fontSize: `${Math.min(fs * 0.42, 28)}px`,
        color: "#ffdd44", backgroundColor: "#332200",
        padding: { x: 18, y: 8 },
      }).setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
        .on("pointerdown", () => this.undoMove()));
    }

    add(this.add.text(cx, cy + h * 0.20, "[ Новая игра ]", {
      fontSize: `${Math.min(fs * 0.42, 28)}px`,
      color: "#ffffff", backgroundColor: "#440000",
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setDepth(DEPTH_UI).setInteractive()
      .on("pointerdown", () => this.scene.restart()));
  }

  _clearGameOverOverlay() {
    this._gameOverObjs.forEach(o => o.destroy());
    this._gameOverObjs = [];
  }

  // ─── Misc ─────────────────────────────────────────────────────────────────

  toggleFullscreen() {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.soundBtn.setText(this.soundEnabled ? "🔊" : "🔇");
  }
}
