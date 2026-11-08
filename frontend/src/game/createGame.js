import Phaser from 'phaser'
import { lostKingdom } from './data/missions/lostKingdom.js'
import { LostKingdomScene } from './scenes/LostKingdomScene.js'

export function createGame(parent, store, onMessage, audio) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: lostKingdom.world.width,
    height: lostKingdom.world.height,
    backgroundColor: '#10121c',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    scene: [new LostKingdomScene(store, onMessage, audio)],
  })
}
