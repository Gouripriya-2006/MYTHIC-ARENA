import { createGame } from './createGame.js'
import { createGameStore } from './state/gameStore.js'
import { renderCharacterSelectView } from './ui/CharacterSelectView.js'
import { renderGameHud } from './ui/GameHud.js'
import { createPhaserVoiceActionDispatcher } from './ai/voiceActionDispatcher.js'
import { getAudioManager } from '../audio/audioManager.js'
import './ui/game.css'

export function mountGameApp() {
  const audio = getAudioManager()
  const gameRoot = document.createElement('div')
  gameRoot.className = 'game-root'
  document.body.append(gameRoot)
  let game = null
  let hud = null
  let routeVersion = 0

  function isGameRoute() {
    return window.location.hash === '#/play' || window.location.hash.startsWith('#/play?')
  }

  function cleanupMission() {
    hud?.destroy()
    hud = null
    if (game) {
      game.destroy(true)
      game = null
    }
  }

  function startMission(heroSelection) {
    cleanupMission()
    const store = createGameStore(heroSelection)
    hud = renderGameHud(gameRoot, store, audio)
    game = createGame(hud.canvas, store, hud.setMessage, audio)
    hud.setVoiceIntentHandler((intent) => {
      const scene = game?.scene.getScene('LostKingdomScene')
      const result = createPhaserVoiceActionDispatcher(scene).dispatch(intent)
      if (!result.ok) hud?.setMessage(result.error)
      return result
    })
  }

  function renderRoute() {
    const version = ++routeVersion
    if (!isGameRoute()) {
      cleanupMission()
      document.body.classList.remove('game-mode')
      return
    }

    document.body.classList.add('game-mode')
    cleanupMission()
    const route = window.location.hash.slice('#/play'.length)
    const params = new URLSearchParams(route.startsWith('?') ? route.slice(1) : '')
    renderCharacterSelectView(gameRoot, params.get('character'), (heroSelection) => {
      if (version === routeVersion) startMission(heroSelection)
    })
  }

  window.addEventListener('hashchange', renderRoute)
  renderRoute()

  return () => {
    routeVersion += 1
    window.removeEventListener('hashchange', renderRoute)
    cleanupMission()
    document.body.classList.remove('game-mode')
    gameRoot.remove()
  }
}
