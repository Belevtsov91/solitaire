import Phaser from "phaser";
import { SUITS, VALUES } from "../constants.js";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    // Background panel
    this.add.rectangle(cx, cy, 440, 100, 0x001122).setDepth(0);

    // Progress bar track
    this.add.rectangle(cx, cy + 10, 380, 22, 0x001133).setDepth(1);

    // Progress bar fill (grows from left)
    const bar = this.add
      .rectangle(cx - 190, cy + 10, 0, 18, 0x00aaff)
      .setOrigin(0, 0.5)
      .setDepth(2);

    // Label
    const label = this.add
      .text(cx, cy - 26, "Загрузка...", { fontSize: "20px", color: "#aaddff" })
      .setOrigin(0.5)
      .setDepth(2);

    this.load.on("progress", (value) => {
      bar.setSize(380 * value, 18);
      label.setText(`Загрузка... ${Math.round(value * 100)}%`);
    });

    // Card back
    this.load.image("cardBack", "/assets/cards/back_of_cards.jpg");

    // All card faces
    for (const suit of SUITS) {
      for (const value of VALUES) {
        const key = `${value}_of_${suit}`;
        this.load.image(key, `/assets/cards/${key}.png`);
      }
    }

    // Sounds
    this.load.audio("cardMove",  "/assets/sounds/card_move.mp3");
    this.load.audio("cardPlace", "/assets/sounds/card_place.mp3");
    this.load.audio("shuffle",   "/assets/sounds/shuffle.mp3");
    this.load.audio("win",       "/assets/sounds/win.mp3");
  }

  create() {
    this.scene.start("GameScene");
  }
}
