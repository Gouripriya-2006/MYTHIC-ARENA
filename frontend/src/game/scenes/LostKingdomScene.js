import Phaser from 'phaser'
import { appearanceOptions, characters } from '../data/characters.js'
import { lostKingdom } from '../data/missions/lostKingdom.js'
import {
  canExecutePhaserVoiceAttack,
} from '../ai/voiceActionDispatcher.js'
import { executePhaserAttack, executePhaserVoiceAction } from './phaserAttackHandler.js'

const distanceBetween = (a, b) => Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y)
const colorValue = (hex) => Number.parseInt(hex.slice(1), 16)

export class LostKingdomScene extends Phaser.Scene {
  constructor(store, onMessage, audio) {
    super({ key: 'LostKingdomScene' })
    this.store = store
    this.onMessage = onMessage
    this.audio = audio
    this.lastContactDamage = 0
    this.lastPositionSync = 0
    this.lastAttack = 0
    this.sceneUnsubscribe = null
  }

  create() {
    const { width, height } = lostKingdom.world
    this.drawWorld(width, height)
    this.createRelic()
    this.createGate()
    this.createSentinel()
    this.createPlayer()
    this.createControls()

    this.sceneUnsubscribe = this.store.subscribe((state) => {
      if (state.status !== 'active') {
        this.keys = null
      }
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sceneUnsubscribe?.()
    })
    this.cameras.main.setBounds(0, 0, width, height)
    this.cameras.main.setRoundPixels(true)
    this.onMessage('The ruins are quiet. Find the Sun Relic.')
  }

  drawWorld(width, height) {
    this.add.rectangle(width / 2, height / 2, width, height, 0x11131d)
    const stars = this.add.graphics()
    for (let index = 0; index < 70; index += 1) {
      const x = (index * 137 + 41) % width
      const y = (index * 83 + 17) % 180
      stars.fillStyle(index % 5 === 0 ? 0xd8bc80 : 0x8c9bbb, index % 5 === 0 ? 0.65 : 0.34)
      stars.fillCircle(x, y, index % 6 === 0 ? 1.5 : 1)
    }

    const backdrop = this.add.graphics()
    backdrop.fillStyle(0x171b28, 1)
    backdrop.fillTriangle(0, 299, 112, 121, 233, 299)
    backdrop.fillStyle(0x202335, 1)
    backdrop.fillTriangle(90, 299, 268, 91, 435, 299)
    backdrop.fillStyle(0x171b28, 1)
    backdrop.fillTriangle(260, 299, 437, 146, 595, 299)
    backdrop.fillStyle(0x242338, 1)
    backdrop.fillTriangle(501, 299, 723, 95, 960, 299)
    backdrop.fillStyle(0x2a2330, 1)
    backdrop.fillRect(0, 300, width, height - 300)
    backdrop.fillStyle(0x382a2e, 0.72)
    backdrop.fillRect(0, 303, width, 5)

    for (let index = 0; index < 11; index += 1) {
      const x = 25 + index * 91
      const y = 342 + (index % 3) * 58
      backdrop.fillStyle(index % 2 ? 0x45323a : 0x3c3039, 0.52)
      backdrop.fillEllipse(x, y, 42 + (index % 3) * 10, 10)
      if (index % 2 === 0) {
        backdrop.lineStyle(2, 0x83684b, 0.42)
        backdrop.strokeLineShape(new Phaser.Geom.Line(x - 9, y + 3, x + 7, y + 1))
      }
    }

    this.drawRuin(260, 221)
    this.drawRuin(748, 207)
    this.add.text(width / 2, 25, 'THE SHATTERED VEIL', {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#b8a879',
      letterSpacing: 4,
    }).setOrigin(0.5)
  }

  drawRuin(x, y) {
    const ruin = this.add.graphics()
    ruin.fillStyle(0x36303a, 1)
    ruin.fillRect(x - 47, y, 94, 83)
    ruin.fillRect(x - 62, y + 17, 18, 66)
    ruin.fillRect(x + 44, y + 17, 18, 66)
    ruin.fillTriangle(x - 58, y + 3, x, y - 28, x + 58, y + 3)
    ruin.fillStyle(0x171720, 1)
    ruin.fillRoundedRect(x - 16, y + 45, 32, 38, 15)
    ruin.lineStyle(2, 0x75624f, 0.58)
    ruin.strokeRect(x - 47, y + 4, 94, 78)
  }

  createRelic() {
    const { x, y } = lostKingdom.relic
    this.relicGlow = this.add.circle(x, y, 25, 0xe9b84e, 0.12)
    this.tweens.add({
      targets: this.relicGlow,
      alpha: { from: 0.15, to: 0.46 },
      scale: { from: 0.84, to: 1.2 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    })
    const relic = this.add.graphics()
    relic.fillStyle(0xffdf8d, 1)
    relic.fillPoints([
      new Phaser.Math.Vector2(x, y - 17),
      new Phaser.Math.Vector2(x + 12, y),
      new Phaser.Math.Vector2(x, y + 17),
      new Phaser.Math.Vector2(x - 12, y),
    ], true)
    relic.fillStyle(0xfff4c7, 0.9)
    relic.fillCircle(x, y, 4)
    this.relicObject = relic
    this.add.text(x, y + 28, 'SUN RELIC', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#f1d38b',
      letterSpacing: 2,
    }).setOrigin(0.5)
  }

  createGate() {
    const { x, y } = lostKingdom.gate
    const gate = this.add.graphics()
    gate.lineStyle(9, 0x7b674d, 1)
    gate.strokeRoundedRect(x - 39, y - 86, 78, 172, 37)
    gate.lineStyle(2, 0xc3a36a, 0.7)
    gate.strokeRoundedRect(x - 28, y - 76, 56, 160, 29)
    gate.fillStyle(0x141321, 0.92)
    gate.fillRoundedRect(x - 25, y - 72, 50, 154, 26)
    gate.lineStyle(2, 0xbaa16d, 0.34)
    gate.strokeEllipse(x, y - 5, 28, 60)
    this.gateGlow = this.add.circle(x, y - 6, 14, 0x6da9ff, 0.05)
    this.add.text(x, y + 101, 'ANCIENT GATE', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#b8b2c7',
      letterSpacing: 2,
    }).setOrigin(0.5)
  }

  createSentinel() {
    const { x, y } = lostKingdom.sentinel
    this.sentinel = this.add.container(x, y)
    const figure = this.add.graphics()
    figure.fillStyle(0x10111b, 0.65)
    figure.fillEllipse(0, 31, 58, 15)
    figure.fillStyle(0x343451, 1)
    figure.fillRoundedRect(-21, -6, 42, 44, 13)
    figure.fillStyle(0x24263d, 1)
    figure.fillCircle(0, -20, 17)
    figure.fillStyle(0x87a9ff, 1)
    figure.fillCircle(-6, -21, 2.4)
    figure.fillCircle(6, -21, 2.4)
    figure.lineStyle(2, 0x7087c8, 0.8)
    figure.strokeRoundedRect(-24, -9, 48, 50, 15)
    this.sentinel.add(figure)
    this.sentinelBody = figure
    this.sentinelAura = this.add.circle(x, y - 6, 37, 0x708cff, 0.06)
    this.tweens.add({ targets: this.sentinelAura, alpha: { from: 0.05, to: 0.23 }, duration: 900, yoyo: true, repeat: -1 })
    this.sentinelLabel = this.add.text(x, y + 48, 'VEIL SENTINEL', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '9px',
      color: '#9eade6',
      letterSpacing: 2,
    }).setOrigin(0.5)
  }

  createPlayer() {
    const { x, y } = lostKingdom.playerStart
    const state = this.store.getState()
    const character = characters.find(({ id }) => id === state.characterId)
    const hero = state.hero
    const skin = appearanceOptions.skinTones.find(({ id }) => id === hero.appearance.skinToneId)
    const outfit = appearanceOptions.outfits.find(({ id }) => id === hero.appearance.outfitId)
    this.player = this.add.container(x, y)
    const figure = this.add.graphics()
    const skinColor = colorValue(skin.color)
    const outfitColor = colorValue(outfit.color)
    const outfitAccent = colorValue(outfit.accent)
    const hairColor = 0x211920
    const shoulderWidth = hero.gender === 'female' ? 19 : 21

    figure.fillStyle(0x0b0a10, 0.56)
    figure.fillEllipse(0, 30, 48, 13)
    figure.fillStyle(hairColor, 1)
    if (hero.appearance.hairstyleId === 'long') {
      figure.fillRoundedRect(-15, -28, 30, 43, 12)
      figure.fillRoundedRect(-17, -18, 8, 37, 4)
      figure.fillRoundedRect(9, -18, 8, 37, 4)
    } else if (hero.appearance.hairstyleId === 'braided') {
      figure.fillCircle(0, -19, 15)
      figure.fillRoundedRect(-17, -15, 7, 45, 4)
      figure.fillRoundedRect(10, -15, 7, 45, 4)
      figure.fillStyle(0x9a7750, 1)
      for (let braidY = -8; braidY < 27; braidY += 9) {
        figure.fillCircle(-13.5, braidY, 2)
        figure.fillCircle(13.5, braidY, 2)
      }
      figure.fillStyle(hairColor, 1)
    } else {
      figure.fillCircle(0, -19, hero.appearance.hairstyleId === 'cropped' ? 14 : 16)
    }

    figure.fillStyle(outfitColor, 1)
    figure.fillRoundedRect(-16, -5, 32, 37, 11)
    figure.fillStyle(outfitAccent, 1)
    figure.fillTriangle(-22, 1, -8, -8, -7, 17)
    figure.fillTriangle(22, 1, 8, -8, 7, 17)
    figure.fillStyle(0x0b0a10, 0.56)
    figure.fillEllipse(0, 30, 48, 13)
    figure.fillStyle(skinColor, 1)
    figure.fillRoundedRect(-5, -12, 10, 11, 3)
    figure.fillEllipse(0, -18, 24, hero.gender === 'female' ? 29 : 27)
    figure.fillStyle(hairColor, 1)
    if (hero.appearance.hairstyleId === 'crest') {
      figure.fillTriangle(-12, -28, 0, -45, 12, -28)
      figure.fillRoundedRect(-14, -29, 28, 8, 5)
    } else if (hero.appearance.hairstyleId === 'cropped') {
      figure.fillEllipse(0, -29, 27, 11)
    } else if (hero.appearance.hairstyleId === 'braided') {
      figure.fillEllipse(0, -30, 26, 13)
      figure.fillStyle(outfitAccent, 1)
      figure.fillCircle(0, -35, 3)
    } else {
      figure.fillEllipse(0, -29, 27, 14)
    }
    figure.fillStyle(0x211920, 1)
    if (hero.appearance.faceId === 'noble') {
      figure.fillStyle(outfitAccent, 1)
      figure.fillTriangle(-6, -41, 0, -49, 6, -41)
    } else if (hero.appearance.faceId === 'marked') {
      figure.fillStyle(character.color, 1)
      figure.fillTriangle(-2, -24, 0, -31, 2, -24)
    } else {
      figure.lineStyle(1.5, 0x8e5148, 0.9)
      figure.strokeLineShape(new Phaser.Geom.Line(-7, -13, -2, -11))
    }
    figure.fillStyle(0x241920, 1)
    figure.fillCircle(-5, -18, 1.4)
    figure.fillCircle(5, -18, 1.4)
    figure.fillStyle(outfitAccent, 1)
    figure.fillRoundedRect(-shoulderWidth, -7, 8, 15, 3)
    figure.fillRoundedRect(shoulderWidth - 8, -7, 8, 15, 3)
    figure.fillRect(-2, -2, 4, 25)
    figure.fillStyle(character.color, 1)
    figure.fillCircle(0, 6, 3)
    figure.lineStyle(2, character.color, 0.86)
    figure.strokeRoundedRect(-shoulderWidth - 1, -9, shoulderWidth * 2 + 2, 43, 12)
    figure.lineStyle(2, 0xe4d8c3, 0.9)
    figure.strokeLineShape(new Phaser.Geom.Line(15, 2, 26, -15))
    this.player.add(figure)
    this.player.setSize(34, 48)
    this.player.setDepth(10)
    this.heroNameLabel = this.add.text(x, y - 53, hero.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#f0e2c2',
      stroke: '#17121b',
      strokeThickness: 3,
    }).setOrigin(0.5)
    this.heroNameLabel.setDepth(1000)
  }

  createControls() {
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      interact: Phaser.Input.Keyboard.KeyCodes.E,
      attack: Phaser.Input.Keyboard.KeyCodes.SPACE,
      instantAttack: Phaser.Input.Keyboard.KeyCodes.J,
    })
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.J,
    ])
    this.keys.interact.on('down', () => this.interact())
    this.keys.attack.on('down', () => this.attack())
    this.keys.instantAttack.on('down', () => this.attack({ instantDefeat: true }))
  }

  update(_time, delta) {
    const state = this.store.getState()
    if (state.status !== 'active' || !this.keys) return

    const horizontal = Number(this.keys.right.isDown || this.keys.arrowRight.isDown)
      - Number(this.keys.left.isDown || this.keys.arrowLeft.isDown)
    const vertical = Number(this.keys.down.isDown || this.keys.arrowDown.isDown)
      - Number(this.keys.up.isDown || this.keys.arrowUp.isDown)
    if (horizontal || vertical) {
      const speed = 180 * (delta / 1000)
      const scale = horizontal && vertical ? Math.SQRT1_2 : 1
      this.player.x = Phaser.Math.Clamp(this.player.x + horizontal * speed * scale, 30, lostKingdom.world.width - 30)
      this.player.y = Phaser.Math.Clamp(this.player.y + vertical * speed * scale, 100, lostKingdom.world.height - 28)
      this.player.setDepth(this.player.y)
      this.heroNameLabel.setPosition(this.player.x, this.player.y - 53)
      this.sentinel.setDepth(this.sentinel.y)
      if (this.time.now - this.lastPositionSync > 100) {
        this.store.setPlayerPosition(this.player.x, this.player.y)
        this.lastPositionSync = this.time.now
      }
    }
    this.updateSentinel(delta, state)

  }

  updateSentinel(delta, state) {
    if (state.sentinelHealth <= 0) return
    if (state.objectives.relic) {
      const distance = distanceBetween(this.player, this.sentinel)
      if (distance > 42) {
        const step = Math.min(42, 0.65 * (delta / 16.67))
        this.sentinel.x += ((this.player.x - this.sentinel.x) / distance) * step
        this.sentinel.y += ((this.player.y - this.sentinel.y) / distance) * step
        this.sentinelAura.setPosition(this.sentinel.x, this.sentinel.y - 6)
      }
      if (distanceBetween(this.player, this.sentinel) < 44 && this.time.now - this.lastContactDamage > 1250) {
        const previousHealth = this.store.getState().health
        this.store.takeDamage(lostKingdom.sentinel.damage)
        if (this.store.getState().health < previousHealth) {
          this.audio?.play('enemy-attack')
          this.audio?.play('player-hit')
        }
        this.lastContactDamage = this.time.now
        this.onMessage(`The Veil Sentinel strikes. ${this.store.getState().health} vitality remains.`)
        this.cameras.main.shake(120, 0.003)
      }
    } else {
      this.sentinel.y += Math.sin(this.time.now / 520) * 0.12
      this.sentinelAura.setPosition(this.sentinel.x, this.sentinel.y - 6)
    }
  }

  interact() {
    const state = this.store.getState()
    if (state.status !== 'active') return

    if (!state.objectives.relic && distanceBetween(this.player, lostKingdom.relic) < 58) {
      this.store.recoverRelic()
      this.audio?.play('relic')
      this.relicGlow?.destroy()
      this.relicObject?.destroy()
      this.onMessage('The Sun Relic answers your touch. The Veil Sentinel stirs!')
      this.cameras.main.flash(240, 218, 180, 95)
      return
    }
    if (distanceBetween(this.player, lostKingdom.gate) < 82) {
      if (state.objectives.relic && state.objectives.sentinel) {
        this.store.reachGate()
        this.audio?.play('victory')
        this.audio?.playMusic('victory')
        this.gateGlow.setFillStyle(0x83d8c4, 0.65)
        this.onMessage('The ancient gate opens. The lost kingdom is yours to restore.')
      } else {
        this.onMessage('The gate is sealed. Recover the relic and defeat its sentinel first.')
      }
      return
    }
    this.onMessage('Nothing nearby answers your call. Explore the ruins.')
  }

  canExecuteVoiceAction(action) {
    const state = this.store.getState()
    if (state.status !== 'active' || !this.player) return false
    if (action === 'interact_nearest') {
      const relicDistance = distanceBetween(this.player, lostKingdom.relic)
      const gateDistance = distanceBetween(this.player, lostKingdom.gate)
      const relicAvailable = !state.objectives.relic && relicDistance < 58
      const gateAvailable = gateDistance < 82
      return relicAvailable || gateAvailable
    }
    if (action !== 'light_attack') return false

    const attackContext = {
      state,
      player: this.player,
      sentinel: this.sentinel,
      now: this.time.now,
      lastAttack: this.lastAttack,
    }
    return canExecutePhaserVoiceAttack(attackContext)
  }

  getVoiceActionRejectionReason(action) {
    if (action !== 'light_attack') return 'That action is not available in the current game state.'
    const state = this.store.getState()
    if (state.status !== 'active') return 'The game is not in an active state.'
    if (!state.objectives.relic || state.sentinelHealth <= 0) return 'No active enemies found.'
    if (this.time.now - this.lastAttack < 420) return 'Your next strike is not ready yet.'
    return 'No active enemies found.'
  }

  executeVoiceAction(action) {
    return executePhaserVoiceAction(this, action)
  }

  attack(options) {
    return executePhaserAttack(this, options)
  }
}
