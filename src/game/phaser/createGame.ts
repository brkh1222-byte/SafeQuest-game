import * as Phaser from "phaser";
import { GAME_H, GAME_W } from "../constants";
import { MicroGameScene, type MicroGameSceneData } from "./MicroGameScene";

export function createGame(parent: HTMLElement, data: MicroGameSceneData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_W,
    height: GAME_H,
    backgroundColor: "#1b1b2f",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 1 },
    banner: false,
  });
  game.scene.add("micro", MicroGameScene, true, data);
  return game;
}
