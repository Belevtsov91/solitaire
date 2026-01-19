import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.load.image("cardBack", "/assets/cards/back_of_cards.jpg");

    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const values = [
      "ace",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "jack",
      "queen",
      "king",
    ];

    for (let suit of suits) {
      for (let value of values) {
        const key = `${value}_of_${suit}`;
        this.load.image(key, `/assets/cards/${key}.png`);
      }
    }

    this.load.image("btnHint", "/assets/ui/btn_hint.png");
    this.load.image("btnShuffle", "/assets/ui/btn_shuffle.png");
    this.load.image("btnSound", "/assets/ui/btn_sound.png");
    this.load.image("btnFullscreen", "/assets/ui/btn_fullscreen.png");
  }

  create() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.soundEnabled = true;

    this.buildDirection = null;

    this.createCrescent(centerX, centerY, 300, 16);

    this.createAceRow(centerX - 600, centerY + 150);

    this.createKingRow(centerX + 300, centerY + 150);

    this.createButtons();

    this.input.keyboard.on("keydown-F", () => {
      this.toggleFullscreen();
    });
  }

  createCrescent(centerX, centerY, radius, total) {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const values = [
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "jack",
      "queen",
    ];

    const deck = [];
    for (let suit of suits) {
      for (let value of values) {
        deck.push(`${value}_of_${suit}`);
      }
    }

    Phaser.Utils.Array.Shuffle(deck);

    let deckIndex = 0;

    const cards = [];
    const startAngle = -180;
    const endAngle = 25;
    const angleStep = (startAngle - endAngle) / total;

    outerLoop: for (let i = 0; i < total; i++) {
      const angleDeg = startAngle - i * angleStep;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      const x = centerX + Math.cos(angleRad) * radius * 1.2;
      const y = centerY + Math.sin(angleRad) * radius * 0.9;

      const stackDepth = 3;
      let prevCard = null;
      let lastCard = null;
      let isLastCardInStack = false;

      for (let j = 0; j < stackDepth; j++) {
        if (deckIndex >= deck.length) {
          isLastCardInStack = true;
          break;
        }
        const faceKey = deck[deckIndex];
        deckIndex++;

        const isLast = j === stackDepth - 1 || deckIndex >= deck.length;

        const card = this.add
          .image(x, y + j * 4, isLast ? faceKey : "cardBack")
          .setScale(0.45)
          .setDepth(i * 10 + j)
          .setRotation(Phaser.Math.DegToRad(angleDeg + 90));

        card.faceKey = faceKey;
        card.startX = x;
        card.startY = y + j * 4;
        card.stackId = i;
        card.stackIndex = j;
        card.originalRotation = Phaser.Math.DegToRad(angleDeg + 90);

        prevCard = card;
        lastCard = card;
        cards.push(card);
      }

      if (lastCard) {
        if (lastCard.texture.key === "cardBack") {
          lastCard.setTexture(lastCard.faceKey);
        }

        lastCard.setInteractive({ draggable: true });
        this.input.setDraggable(lastCard);

        lastCard.on("dragstart", () => {
          this.openNextCard(lastCard);
        });
      }

      if (isLastCardInStack) {
        break outerLoop;
      }
    }

    this.cards = cards;

    this.input.on("dragstart", (pointer, gameObject) => {
      gameObject.setRotation(0);
      gameObject.setDepth(1000);
      gameObject.setScale(0.5);
    });

    this.input.on("drag", (pointer, gameObject, dragX, dragY) => {
      gameObject.x = dragX;
      gameObject.y = dragY;
    });

    this.input.on("dragend", (pointer, gameObject) => {
      this.handleCardDrop(gameObject);
    });
  }

  flipCard(card) {
    if (card.texture.key !== "cardBack") return;

    if (card.isFlipping) return;
    card.isFlipping = true;

    this.tweens.add({
      targets: card,
      scaleX: 0,
      duration: 180,
      ease: "Quad.easeIn",
      onComplete: () => {
        card.setTexture(card.faceKey);

        this.tweens.add({
          targets: card,
          scaleX: 0.45,
          duration: 180,
          ease: "Quad.easeOut",
          onComplete: () => {
            card.isFlipping = false;

            this.openNextCard(card);
          },
        });
      },
    });
  }

  openNextCard(topCard) {
    const sameStack = this.cards
      .filter((c) => c.stackId === topCard.stackId)
      .sort((a, b) => b.stackIndex - a.stackIndex);

    const topIndex = sameStack.indexOf(topCard);

    if (sameStack[topIndex + 1]) {
      const nextCard = sameStack[topIndex + 1];

      if (nextCard.input && nextCard.input.draggable) {
        return;
      }

      if (nextCard.texture.key === "cardBack" && nextCard.faceKey) {
        nextCard.setTexture(nextCard.faceKey);
      }

      const newY = nextCard.y - 6;

      this.tweens.add({
        targets: nextCard,
        y: newY,
        alpha: 1,
        duration: 250,
        ease: "Sine.easeOut",
        onComplete: () => {
          nextCard.startY = newY;

          nextCard.setInteractive({ draggable: true });
          this.input.setDraggable(nextCard);

          nextCard.on("dragstart", () => {
            this.openNextCard(nextCard);
          });

          nextCard.on("dragend", () => {
            this.handleCardDrop(nextCard);
          });
        },
      });
    }
  }

  handleCardDrop(draggedCard) {
    let placed = false;

    if (this.buildDirection !== "king") {
      for (let aceCard of this.aceRow) {
        const distance = Phaser.Math.Distance.Between(
          draggedCard.x,
          draggedCard.y,
          aceCard.x,
          aceCard.y,
        );

        if (distance < 60) {
          if (this.canPlaceOnAce(draggedCard, aceCard)) {
            if (this.buildDirection === null) {
              this.buildDirection = "ace";
            }
            this.placeCardOnFoundation(draggedCard, aceCard);
            placed = true;
            break;
          }
        }
      }
    }

    if (!placed && this.buildDirection !== "ace") {
      for (let kingCard of this.kingRow) {
        const distance = Phaser.Math.Distance.Between(
          draggedCard.x,
          draggedCard.y,
          kingCard.x,
          kingCard.y,
        );

        if (distance < 60) {
          if (this.canPlaceOnKing(draggedCard, kingCard)) {
            if (this.buildDirection === null) {
              this.buildDirection = "king";
            }
            this.placeCardOnFoundation(draggedCard, kingCard);
            placed = true;
            break;
          }
        }
      }
    }

    if (!placed) {
      const originalRotation = draggedCard.originalRotation || 0;

      this.tweens.add({
        targets: draggedCard,
        x: draggedCard.startX,
        y: draggedCard.startY,
        rotation: originalRotation,
        scaleX: 0.45,
        scaleY: 0.45,
        duration: 200,
        ease: "Sine.easeOut",
        onComplete: () => {
          const stackId = draggedCard.stackId || 0;
          const stackIndex = draggedCard.stackIndex || 0;
          draggedCard.setDepth(stackId * 10 + stackIndex);
        },
      });
    }
  }

  placeCardOnFoundation(draggedCard, targetCard) {
    this.tweens.add({
      targets: draggedCard,
      x: targetCard.x,
      y: targetCard.y,
      duration: 200,
      ease: "Sine.easeOut",
      onComplete: () => {
        targetCard.setTexture(draggedCard.faceKey);

        draggedCard.destroy();

        const index = this.cards.indexOf(draggedCard);
        if (index > -1) {
          this.cards.splice(index, 1);
        }

        this.checkWin();
      },
    });
  }

  checkWin() {
    if (this.cards.length === 0) {
      this.time.delayedCall(500, () => {
        this.playWinAnimation();
      });
    }
  }

  playWinAnimation() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const usedCards =
      this.buildDirection === "ace" ? this.aceRow : this.kingRow;
    const unusedCards =
      this.buildDirection === "ace" ? this.kingRow : this.aceRow;

    usedCards.forEach((card, i) => {
      this.tweens.add({
        targets: card,
        x: centerX,
        y: centerY - 100,
        rotation: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 800,
        delay: i * 100,
        ease: "Back.easeInOut",
      });
    });

    unusedCards.forEach((card, i) => {
      this.tweens.add({
        targets: card,
        x: centerX,
        y: centerY - 100,
        rotation: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 0.3,
        duration: 800,
        delay: 400 + i * 100,
        ease: "Back.easeInOut",
      });
    });

    this.time.delayedCall(1200, () => {
      const winText = this.add
        .text(centerX, centerY + 100, "🎉 ПОБЕДА! 🎉", {
          fontSize: "72px",
          color: "#FFD700",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 8,
          shadow: {
            offsetX: 4,
            offsetY: 4,
            color: "#000000",
            blur: 8,
            fill: true,
          },
        })
        .setOrigin(0.5)
        .setDepth(2000)
        .setAlpha(0);

      this.tweens.add({
        targets: winText,
        alpha: 1,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 600,
        ease: "Bounce.easeOut",
      });

      const resultText = this.add
        .text(
          centerX,
          centerY + 180,
          this.buildDirection === "ace"
            ? "Собрали все на Тузов!"
            : "Собрали все на Королей!",
          {
            fontSize: "36px",
            color: "#FFFFFF",
            fontStyle: "bold",
          },
        )
        .setOrigin(0.5)
        .setDepth(2000)
        .setAlpha(0);

      this.tweens.add({
        targets: resultText,
        alpha: 1,
        duration: 400,
        delay: 300,
        ease: "Sine.easeOut",
      });
    });
  }

  createButtons() {
    const y = this.scale.height - 80;

    const newGame = this.add
      .text(50, 50, "🔄", { fontSize: "48px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setInteractive()
      .on("pointerdown", () => this.scene.restart());

    const hint = this.add
      .text(120, y, "💡", { fontSize: "64px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setInteractive()
      .on("pointerdown", () => this.showHint());

    const shuffle = this.add
      .text(300, y, "🔀", { fontSize: "64px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setInteractive()
      .on("pointerdown", () => this.shuffleCrescent());

    const sound = this.add
      .text(this.scale.width - 300, y, "🔊", { fontSize: "64px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setInteractive()
      .on("pointerdown", () => {
        this.soundEnabled = !this.soundEnabled;
        sound.setText(this.soundEnabled ? "🔊" : "🔇");
        console.log("Sound:", this.soundEnabled ? "ON" : "OFF");
      });

    const fullscreen = this.add
      .text(this.scale.width - 120, y, "⛶", { fontSize: "64px" })
      .setOrigin(0.5)
      .setDepth(2000)
      .setInteractive()
      .on("pointerdown", () => this.toggleFullscreen());
  }

  toggleFullscreen() {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  }

  showDirectionDialog() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const overlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7)
      .setOrigin(0)
      .setDepth(1000);

    const panel = this.add
      .rectangle(centerX, centerY, 600, 400, 0x1a3a52)
      .setDepth(1001)
      .setStrokeStyle(4, 0xffffff);

    const title = this.add
      .text(centerX, centerY - 120, "Выберите направление:", {
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const aceBtn = this.add
      .rectangle(centerX, centerY - 20, 400, 80, 0x2ecc71)
      .setDepth(1001)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => aceBtn.setFillStyle(0x27ae60))
      .on("pointerout", () => aceBtn.setFillStyle(0x2ecc71))
      .on("pointerdown", () => {
        this.buildDirection = "ace";
        this.closeDirectionDialog(
          overlay,
          panel,
          title,
          aceBtn,
          aceBtnText,
          kingBtn,
          kingBtnText,
        );
      });

    const aceBtnText = this.add
      .text(centerX, centerY - 20, "На Тузов (A → K)", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const kingBtn = this.add
      .rectangle(centerX, centerY + 80, 400, 80, 0xe74c3c)
      .setDepth(1001)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => kingBtn.setFillStyle(0xc0392b))
      .on("pointerout", () => kingBtn.setFillStyle(0xe74c3c))
      .on("pointerdown", () => {
        this.buildDirection = "king";
        this.closeDirectionDialog(
          overlay,
          panel,
          title,
          aceBtn,
          aceBtnText,
          kingBtn,
          kingBtnText,
        );
      });

    const kingBtnText = this.add
      .text(centerX, centerY + 80, "На Королей (K → A)", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(1002);
  }

  closeDirectionDialog(
    overlay,
    panel,
    title,
    aceBtn,
    aceBtnText,
    kingBtn,
    kingBtnText,
  ) {
    overlay.destroy();
    panel.destroy();
    title.destroy();
    aceBtn.destroy();
    aceBtnText.destroy();
    kingBtn.destroy();
    kingBtnText.destroy();
  }

  shuffleCrescent() {
    const remainingCards = this.cards.filter((card) => card && card.active);

    if (remainingCards.length === 0) {
      console.log("Нет карт для перетасовки");
      return;
    }

    const faceKeys = remainingCards.map((card) => card.faceKey);

    remainingCards.forEach((card) => card.destroy());

    this.cards = [];

    Phaser.Utils.Array.Shuffle(faceKeys);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const radius = 300;
    const totalStacks = 16;

    const startAngle = -180;
    const endAngle = 25;
    const angleStep = (startAngle - endAngle) / totalStacks;

    const cards = [];
    let deckIndex = 0;

    outerLoop: for (let i = 0; i < totalStacks; i++) {
      const angleDeg = startAngle - i * angleStep;
      const angleRad = Phaser.Math.DegToRad(angleDeg);

      const x = centerX + Math.cos(angleRad) * radius * 1.2;
      const y = centerY + Math.sin(angleRad) * radius * 0.9;

      const stackDepth = 3;
      let lastCard = null;
      let isLastCardInStack = false;

      for (let j = 0; j < stackDepth; j++) {
        if (deckIndex >= faceKeys.length) {
          isLastCardInStack = true;
          break;
        }

        const faceKey = faceKeys[deckIndex];
        deckIndex++;

        const isLast = j === stackDepth - 1 || deckIndex >= faceKeys.length;

        const card = this.add
          .image(x, y + j * 4, isLast ? faceKey : "cardBack")
          .setScale(0.45)
          .setDepth(i * 10 + j)
          .setRotation(Phaser.Math.DegToRad(angleDeg + 90));

        card.faceKey = faceKey;
        card.startX = x;
        card.startY = y + j * 4;
        card.stackId = i;
        card.stackIndex = j;
        card.originalRotation = Phaser.Math.DegToRad(angleDeg + 90);

        lastCard = card;
        cards.push(card);
      }

      if (lastCard) {
        if (lastCard.texture.key === "cardBack") {
          lastCard.setTexture(lastCard.faceKey);
        }

        lastCard.setInteractive({ draggable: true });
        this.input.setDraggable(lastCard);

        lastCard.on("dragstart", () => {
          this.openNextCard(lastCard);
        });
      }

      if (isLastCardInStack) {
        break outerLoop;
      }
    }

    this.cards = cards;
    console.log(`Перетасовано ${faceKeys.length} карт`);
  }

  showHint() {
    const topCards = this.cards.filter(
      (card) => card.input && card.input.draggable,
    );

    for (let card of topCards) {
      if (this.buildDirection !== "king") {
        for (let aceCard of this.aceRow) {
          if (this.canPlaceOnAce(card, aceCard)) {
            this.highlightCard(card);
            return;
          }
        }
      }

      if (this.buildDirection !== "ace") {
        for (let kingCard of this.kingRow) {
          if (this.canPlaceOnKing(card, kingCard)) {
            this.highlightCard(card);
            return;
          }
        }
      }
    }

    console.log("Нет доступных ходов");
  }

  highlightCard(card) {
    this.tweens.killTweensOf(card);

    this.tweens.add({
      targets: card,
      scaleX: 0.55,
      scaleY: 0.55,
      duration: 300,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
    });
  }

  createAceRow(startX, y) {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const spacing = 110;

    this.aceRow = suits.map((suit, i) => {
      const key = `ace_of_${suit}`;
      const card = this.add
        .image(startX + i * spacing, y, key)
        .setScale(0.45)
        .setInteractive()
        .setDepth(200);
      return card;
    });
  }

  createKingRow(startX, y) {
    const suits = ["hearts", "diamonds", "clubs", "spades"];
    const spacing = 110;

    this.kingRow = suits.map((suit, i) => {
      const key = `king_of_${suit}`;
      const card = this.add
        .image(startX + i * spacing, y, key)
        .setScale(0.45)
        .setInteractive()
        .setDepth(200);
      return card;
    });
  }

  getCardOrder() {
    return [
      "ace",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "jack",
      "queen",
      "king",
    ];
  }

  getCardValue(faceKey) {
    if (!faceKey) return null;
    const parts = faceKey.split("_of_");
    return {
      value: parts[0],
      suit: parts[1],
    };
  }

  canPlaceOnAce(draggedCard, targetAceCard) {
    const order = this.getCardOrder();
    const dragged = this.getCardValue(draggedCard.faceKey);
    const target = this.getCardValue(targetAceCard.texture.key);

    if (!dragged || !target) return false;

    if (dragged.suit !== target.suit) return false;

    const draggedIndex = order.indexOf(dragged.value);
    const targetIndex = order.indexOf(target.value);

    return draggedIndex === targetIndex + 1;
  }

  canPlaceOnKing(draggedCard, targetKingCard) {
    const order = this.getCardOrder();
    const dragged = this.getCardValue(draggedCard.faceKey);
    const target = this.getCardValue(targetKingCard.texture.key);

    if (!dragged || !target) return false;

    if (dragged.suit !== target.suit) return false;

    const draggedIndex = order.indexOf(dragged.value);
    const targetIndex = order.indexOf(target.value);

    return draggedIndex === targetIndex - 1;
  }
}
