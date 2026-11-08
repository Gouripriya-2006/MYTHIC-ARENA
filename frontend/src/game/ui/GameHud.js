import { characters } from '../data/characters.js'
import { lostKingdom } from '../data/missions/lostKingdom.js'
import { renderVoicePanel } from './VoicePanel.js'
import { renderAudioSettings } from '../../audio/audioManager.js'
import { createVoiceController } from '../ai/gnani/voiceController.js'

export function renderGameHud(root, store, audio) {
  root.innerHTML = `
    <main class="game-shell play-shell">
      <header class="game-topbar">
        <a class="game-brand" href="#home"><span class="game-brand-symbol">✦</span> MYTHIC<span>·</span>ARENA</a>
        <span class="mission-breadcrumb">FIRST MISSION <b>/</b> THE LOST KINGDOM</span>
        <a class="game-exit-link" href="#home">Leave mission <span aria-hidden="true">↗</span></a>
      </header>
      <div class="play-layout">
        <section class="play-main" aria-label="The Lost Kingdom game">
          <div class="play-heading">
            <div><p class="game-eyebrow"><span></span> ${lostKingdom.subtitle}</p><h1>${lostKingdom.title}</h1></div>
            <div class="mission-live"><i></i> MISSION ACTIVE</div>
          </div>
          <div class="canvas-frame">
            <div id="game-canvas" aria-label="Game area"></div>
            <div class="canvas-hint">MOVE <kbd>W A S D</kbd> <kbd>↑ ↓ ← →</kbd><span>INTERACT <kbd>E</kbd></span><span>STRIKE <kbd>SPACE</kbd></span></div>
          </div>
          <div class="combat-readout">
            <span class="combat-readout-label">VEIL SENTINEL</span>
            <span class="sentinel-health-track"><i data-sentinel-health></i></span>
            <span class="sentinel-health-text" data-sentinel-text></span>
            <span class="play-message" role="status" aria-live="polite" data-play-message>Explore the ruins. Your mission begins.</span>
          </div>
        </section>
        <aside class="game-sidebar">
          <section class="game-panel status-panel" aria-labelledby="hero-status-title">
            <div class="game-panel-heading"><span class="game-panel-kicker">YOUR HERO</span><span class="hero-level">LVL 01</span></div>
            <h2 class="hero-name" id="hero-status-title"></h2>
            <p class="hero-epithet"></p>
            <div class="hero-ability"><b></b><span></span></div>
            <div class="health-heading"><span>VITALITY</span><span data-health-text></span></div>
            <div class="health-track"><i data-health-bar></i></div>
          </section>
          <section class="game-panel objective-panel" aria-labelledby="objectives-title">
            <div class="game-panel-heading"><span class="game-panel-kicker">YOUR PURPOSE</span><span class="objective-count"></span></div>
            <h2 id="objectives-title">Mission objectives</h2>
            <ul class="objective-list"></ul>
          </section>
          ${renderVoicePanel({ diagnostics: true, showTranscript: false })}
          <details class="game-panel game-audio-panel">
            <summary>Audio settings</summary>
            <p>Changes apply immediately and are saved on this device.</p>
            ${renderAudioSettings(audio.getSettings(), 'game-audio-setting')}
          </details>
          <p class="controls-note"><b>TIP</b> Approach the glowing relic and press <kbd>E</kbd>. Get close to the sentinel, then press <kbd>SPACE</kbd>.</p>
        </aside>
      </div>
      <div class="mission-result" hidden role="dialog" aria-modal="true" aria-labelledby="mission-result-title">
        <div class="result-seal" aria-hidden="true">✦</div>
        <p class="game-eyebrow"><span></span> THE LOST KINGDOM</p>
        <h2 id="mission-result-title"></h2>
        <p data-result-copy></p>
        <a class="game-primary-button" href="#home">Return to the realm <span aria-hidden="true">↗</span></a>
      </div>
    </main>
  `

  const character = characters.find(({ id }) => id === store.getState().characterId)
  const hero = store.getState().hero
  root.querySelector('.hero-name').textContent = hero.name
  root.querySelector('.hero-epithet').textContent = `${character.name} · ${character.epithet}`
  root.querySelector('.hero-ability b').textContent = character.ability.name
  root.querySelector('.hero-ability span').textContent = character.ability.description
  root.querySelector('.hero-name').style.setProperty('--hero-accent', `#${character.color.toString(16).padStart(6, '0')}`)

  const objectiveList = root.querySelector('.objective-list')
  objectiveList.innerHTML = lostKingdom.objectives.map(({ id, label }) => `
    <li data-objective="${id}"><span class="objective-check" aria-hidden="true"></span><span>${label}</span></li>
  `).join('')

  const healthText = root.querySelector('[data-health-text]')
  const healthBar = root.querySelector('[data-health-bar]')
  const sentinelBar = root.querySelector('[data-sentinel-health]')
  const sentinelText = root.querySelector('[data-sentinel-text]')
  const objectiveCount = root.querySelector('.objective-count')
  const playMessage = root.querySelector('[data-play-message]')
  let dispatchVoiceIntent = () => ({ ok: false, error: 'Voice intent interpretation is unavailable.' })
  const voiceController = createVoiceController(root, {
    game: 'phaser-2d',
    onMessage(message) { playMessage.textContent = message },
    onIntent(intent) { return dispatchVoiceIntent(intent) },
    play: (blob, options) => audio.playAudioBlob(blob, options),
  })
  const result = root.querySelector('.mission-result')
  const resultTitle = root.querySelector('#mission-result-title')
  const resultCopy = root.querySelector('[data-result-copy]')

  const updateHud = (state) => {
    healthText.textContent = `${state.health} / ${state.maxHealth}`
    healthBar.style.width = `${(state.health / state.maxHealth) * 100}%`
    healthBar.classList.toggle('is-critical', state.health / state.maxHealth < 0.3)
    sentinelBar.style.width = `${(state.sentinelHealth / lostKingdom.sentinel.health) * 100}%`
    sentinelText.textContent = `${state.sentinelHealth} / ${lostKingdom.sentinel.health}`
    const completed = Object.values(state.objectives).filter(Boolean).length
    objectiveCount.textContent = `${completed} / ${lostKingdom.objectives.length}`
    Object.entries(state.objectives).forEach(([id, done]) => {
      const item = objectiveList.querySelector(`[data-objective="${id}"]`)
      item.classList.toggle('is-complete', done)
    })

    if (state.status === 'victory' || state.status === 'defeat') {
      result.hidden = false
      resultTitle.textContent = state.status === 'victory' ? 'A kingdom reborn.' : 'The veil closes.'
      resultCopy.textContent = state.status === 'victory'
        ? 'The Sun Relic is restored, the sentinel has fallen, and the gate is open. Your legend has begun.'
        : 'Your strength has faded, but your story need not end here.'
      playMessage.textContent = state.status === 'victory' ? 'Mission complete.' : 'You have fallen in battle.'
    }
  }
  const unsubscribe = store.subscribe(updateHud)
  updateHud(store.getState())

  const onAudioSetting = (event) => {
    const setting = event.target.dataset.setting
    if (!setting) return
    const current = audio.getSettings()
    audio.updateSettings({
      ...current,
      [setting]: event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value),
    })
  }
  root.addEventListener('input', onAudioSetting)
  root.addEventListener('change', onAudioSetting)

  return {
    canvas: root.querySelector('#game-canvas'),
    setMessage(message) {
      playMessage.textContent = message
    },
    setVoiceIntentHandler(handler) {
      dispatchVoiceIntent = handler
    },
    destroy() {
      voiceController.destroy()
      unsubscribe()
      root.removeEventListener('input', onAudioSetting)
      root.removeEventListener('change', onAudioSetting)
    },
  }
}
