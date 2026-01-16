import Phaser from "phaser";
import GameScene from "../src/scenes/GameScenes.js";

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight, 
  backgroundColor: "#002233", 
  parent: "game-container", 
  scene: [GameScene], 
  scale: {
    mode: Phaser.Scale.FIT, 
    autoCenter: Phaser.Scale.CENTER_BOTH, 
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
};


const game = new Phaser.Game(config);


window.addEventListener("resize", () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
