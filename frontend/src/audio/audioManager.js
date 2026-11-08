const SETTINGS_KEY = 'mythic-arena-audio-settings-v1'
const DEFAULT_SETTINGS = Object.freeze({ master: 0.8, music: 0.32, effects: 0.72, muted: false })
const SOUND_COOLDOWNS = Object.freeze({
  'enemy-attack': 350,
  'player-hit': 260,
  'boss-warning': 650,
})

const SOUND_PRESETS = Object.freeze({
  'ui-click': { frequency: 620, endFrequency: 470, duration: 0.055, waveform: 'sine', volume: 0.11 },
  'ui-open': { frequency: 420, endFrequency: 760, duration: 0.16, waveform: 'sine', volume: 0.14 },
  interaction: { frequency: 520, endFrequency: 780, duration: 0.2, waveform: 'sine', volume: 0.18 },
  'player-light': { frequency: 260, endFrequency: 120, duration: 0.16, waveform: 'triangle', volume: 0.26 },
  'player-heavy': { frequency: 155, endFrequency: 72, duration: 0.28, waveform: 'sawtooth', volume: 0.3 },
  ability: { frequency: 390, endFrequency: 880, duration: 0.34, waveform: 'sine', volume: 0.24 },
  'enemy-attack': { frequency: 180, endFrequency: 90, duration: 0.24, waveform: 'sawtooth', volume: 0.24 },
  'enemy-hit': { frequency: 320, endFrequency: 115, duration: 0.13, waveform: 'triangle', volume: 0.24 },
  'player-hit': { frequency: 115, endFrequency: 55, duration: 0.32, waveform: 'sawtooth', volume: 0.35 },
  'enemy-defeat': { frequency: 440, endFrequency: 165, duration: 0.5, waveform: 'triangle', volume: 0.25 },
  'boss-intro': { frequency: 92, endFrequency: 46, duration: 0.9, waveform: 'sawtooth', volume: 0.28 },
  'boss-phase': { frequency: 250, endFrequency: 70, duration: 0.7, waveform: 'triangle', volume: 0.28 },
  'boss-warning': { frequency: 480, endFrequency: 280, duration: 0.24, waveform: 'square', volume: 0.16 },
  relic: { frequency: 660, endFrequency: 990, duration: 0.5, waveform: 'sine', volume: 0.2 },
  victory: { frequency: 523.25, endFrequency: 783.99, duration: 0.8, waveform: 'sine', volume: 0.24 },
})

const MUSIC_SEQUENCES = Object.freeze({
  realm: [
    [146.83, 220, 293.66],
    [130.81, 196, 261.63],
    [164.81, 246.94, 329.63],
    [110, 164.81, 220],
  ],
  boss: [
    [73.42, 110, 146.83],
    [82.41, 123.47, 164.81],
    [69.3, 103.83, 138.59],
    [87.31, 130.81, 174.61],
  ],
  victory: [
    [261.63, 392, 523.25],
    [293.66, 440, 587.33],
    [329.63, 493.88, 659.25],
    [261.63, 392, 523.25],
  ],
})

function normalizeSettings(settings, fallback = DEFAULT_SETTINGS) {
  const volume = (value, previous) => Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : previous
  return {
    master: volume(settings?.master, fallback.master),
    music: volume(settings?.music, fallback.music),
    effects: volume(settings?.effects, fallback.effects),
    muted: typeof settings?.muted === 'boolean' ? settings.muted : fallback.muted,
  }
}

function loadSettings(storage) {
  try {
    const serialized = storage?.getItem(SETTINGS_KEY)
    if (!serialized) return { ...DEFAULT_SETTINGS }
    return normalizeSettings(JSON.parse(serialized))
  } catch (error) {
    console.warn('Unable to load saved audio preferences.', error)
    return { ...DEFAULT_SETTINGS }
  }
}

export function createAudioManager({
  contextFactory = () => {
    const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext
    if (!AudioContextConstructor) throw new Error('Web Audio API is not supported in this browser.')
    return new AudioContextConstructor()
  },
  storage = globalThis.localStorage,
  timers = globalThis,
  now = () => Date.now(),
} = {}) {
  let context = null
  let masterGain = null
  let musicGain = null
  let effectsGain = null
  let unlocked = false
  let disposed = false
  let musicTrack = null
  let musicStep = 0
  let musicTimer = null
  let uiRoot = null
  let uiListeners = null
  const activeNodes = new Set()
  const lastPlayed = new Map()
  let settings = loadSettings(storage)

  function applyGainSettings() {
    if (!context) return
    const muted = settings.muted ? 0 : 1
    masterGain.gain.setTargetAtTime(settings.master * muted, context.currentTime, 0.035)
    musicGain.gain.setTargetAtTime(settings.music, context.currentTime, 0.035)
    effectsGain.gain.setTargetAtTime(settings.effects, context.currentTime, 0.035)
  }

  function ensureContext() {
    if (disposed) return false
    if (context) return true
    try {
      context = contextFactory()
      masterGain = context.createGain()
      musicGain = context.createGain()
      effectsGain = context.createGain()
      musicGain.connect(masterGain)
      effectsGain.connect(masterGain)
      masterGain.connect(context.destination)
      applyGainSettings()
      return true
    } catch (error) {
      console.warn('Unable to initialize game audio.', error)
      return false
    }
  }

  function scheduleTone(preset, destination, { when = 0, volume = 1, duration = preset.duration } = {}) {
    if (!ensureContext() || settings.muted || volume <= 0) return false
    const start = context.currentTime + when
    const oscillator = context.createOscillator()
    const envelope = context.createGain()
    oscillator.type = preset.waveform
    oscillator.frequency.setValueAtTime(preset.frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, preset.endFrequency), start + duration)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, preset.volume * volume), start + Math.min(0.025, duration * 0.18))
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(envelope)
    envelope.connect(destination)
    activeNodes.add(oscillator)
    oscillator.onended = () => {
      activeNodes.delete(oscillator)
      oscillator.disconnect()
      envelope.disconnect()
    }
    oscillator.start(start)
    oscillator.stop(start + duration + 0.02)
    return true
  }

  function stopMusicLoop() {
    if (musicTimer !== null) {
      timers.clearTimeout(musicTimer)
      musicTimer = null
    }
  }

  function scheduleMusicStep() {
    if (!unlocked || !musicTrack || settings.muted || disposed) return
    const sequence = MUSIC_SEQUENCES[musicTrack] ?? MUSIC_SEQUENCES.realm
    const chord = sequence[musicStep % sequence.length]
    chord.forEach((frequency, index) => {
      const preset = {
        frequency,
        endFrequency: frequency * (index === 2 ? 1.004 : 0.998),
        duration: 2.45,
        waveform: index === 0 ? 'triangle' : 'sine',
        volume: index === 0 ? 0.1 : 0.045,
      }
      scheduleTone(preset, musicGain, { when: index * 0.035 })
    })
    musicStep += 1
    musicTimer = timers.setTimeout(scheduleMusicStep, 2800)
  }

  function startMusicLoop() {
    stopMusicLoop()
    if (!musicTrack || !unlocked || settings.muted || disposed) return
    musicStep = 0
    scheduleMusicStep()
  }

  async function unlock() {
    if (!ensureContext()) return false
    if (context.state === 'running') {
      unlocked = true
      if (musicTrack && musicTimer === null) startMusicLoop()
      return true
    }
    try {
      await context.resume()
      unlocked = context.state === 'running'
      if (unlocked && musicTrack) startMusicLoop()
      return unlocked
    } catch (error) {
      console.warn('Browser audio playback could not be resumed.', error)
      return false
    }
  }

  function persistSettings() {
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (error) {
      console.warn('Unable to save audio preferences.', error)
    }
  }

  function updateSettings(nextSettings, { persist = true } = {}) {
    settings = normalizeSettings(nextSettings, settings)
    applyGainSettings()
    if (settings.muted) stopMusicLoop()
    else if (unlocked && musicTrack && musicTimer === null) startMusicLoop()
    if (persist) persistSettings()
    return { ...settings }
  }

  function play(soundId, { volume = 1, cooldown = null } = {}) {
    const preset = SOUND_PRESETS[soundId]
    if (!preset || disposed || settings.muted) return false
    const timestamp = now()
    const minimumInterval = cooldown ?? SOUND_COOLDOWNS[soundId] ?? 70
    if (timestamp - (lastPlayed.get(soundId) ?? -Infinity) < minimumInterval) return false
    lastPlayed.set(soundId, timestamp)
    if (!unlocked || !context || context.state !== 'running') {
      void unlock().then((resumed) => {
        if (resumed && !settings.muted && !disposed) scheduleTone(preset, effectsGain, { volume })
      })
      return false
    }
    return scheduleTone(preset, effectsGain, { volume })
  }

  async function playAudioBlob(blob, { signal } = {}) {
    if (disposed || settings.muted || signal?.aborted || !blob) return false
    if (!await unlock() || signal?.aborted || settings.muted || disposed) return false
    const encoded = await blob.arrayBuffer()
    if (signal?.aborted || settings.muted || disposed) return false
    const decoded = await context.decodeAudioData(encoded)
    if (signal?.aborted || settings.muted || disposed) return false
    const source = context.createBufferSource()
    source.buffer = decoded
    source.connect(masterGain)
    activeNodes.add(source)
    return new Promise((resolve) => {
      const finish = (played) => {
        signal?.removeEventListener('abort', onAbort)
        activeNodes.delete(source)
        source.disconnect()
        resolve(played)
      }
      const onAbort = () => {
        try { source.stop() } catch {}
        finish(false)
      }
      source.onended = () => finish(true)
      signal?.addEventListener('abort', onAbort, { once: true })
      if (signal?.aborted) onAbort()
      else source.start()
    })
  }

  function playMusic(track = 'realm') {
    const nextTrack = MUSIC_SEQUENCES[track] ? track : 'realm'
    if (musicTrack === nextTrack && (musicTimer !== null || !unlocked)) return false
    musicTrack = nextTrack
    if (unlocked && !settings.muted) startMusicLoop()
    return true
  }

  function stopMusic() {
    musicTrack = null
    stopMusicLoop()
  }

  function classifyUiSound(target) {
    if (target.closest('button:disabled, [aria-disabled="true"]')) return null
    if (target.closest('[data-audio-setting], input[type="range"], input[type="checkbox"]')) return null
    const gameAction = target.closest('[data-ui-action]')?.dataset.uiAction
    if (['light-attack', 'heavy-attack', 'ability', 'interact', 'block', 'dodge', 'skip-cinematic'].includes(gameAction)) {
      return null
    }
    if (target.closest('[data-ui-action="interact"], [data-npc-option], [data-buy-item], [data-sell-item], [data-confirm-sale]')) {
      return 'interaction'
    }
    if (target.closest('[data-ui-action="inventory"], [data-ui-action="journal"], [data-ui-action="map"], [data-ui-action="skills"], [data-shop-tab]')) {
      return 'ui-open'
    }
    if (target.closest('button, a, [role="button"]')) return 'ui-click'
    return null
  }

  function attachUI(root = globalThis.document) {
    if (!root?.addEventListener) return () => {}
    if (uiRoot === root && uiListeners) return () => detachUI(root)
    if (uiRoot && uiListeners) detachUI(uiRoot)
    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement
      if (!target) return
      const soundId = classifyUiSound(target)
      if (!soundId) return
      void unlock().then(() => play(soundId, { cooldown: 35 }))
    }
    const onKeyDown = () => { void unlock() }
    root.addEventListener('click', onClick, true)
    root.addEventListener('keydown', onKeyDown, true)
    uiRoot = root
    uiListeners = { onClick, onKeyDown }
    return () => detachUI(root)
  }

  function detachUI(root) {
    if (uiRoot !== root || !uiListeners) return
    root.removeEventListener('click', uiListeners.onClick, true)
    root.removeEventListener('keydown', uiListeners.onKeyDown, true)
    uiRoot = null
    uiListeners = null
  }

  function dispose() {
    disposed = true
    stopMusic()
    if (uiRoot && uiListeners) detachUI(uiRoot)
    for (const node of activeNodes) {
      try {
        node.stop()
        node.disconnect()
      } catch (error) {
        console.warn('Unable to stop an audio voice during cleanup.', error)
      }
    }
    activeNodes.clear()
    if (context && context.state !== 'closed') void context.close()
  }

  return {
    attachUI,
    dispose,
    getSettings: () => ({ ...settings }),
    getStatus: () => ({ unlocked, musicTrack, muted: settings.muted }),
    play,
    playAudioBlob,
    playMusic,
    stopMusic,
    unlock,
    updateSettings,
  }
}

export function renderAudioSettings(settings, settingClass = 'rpg-audio-setting') {
  const values = normalizeSettings(settings)
  return `
    <label class="${settingClass}"><span>Master volume</span><input type="range" min="0" max="1" step=".05" value="${values.master}" data-setting="master"></label>
    <label class="${settingClass}"><span>Music volume</span><input type="range" min="0" max="1" step=".05" value="${values.music}" data-setting="music"></label>
    <label class="${settingClass}"><span>SFX volume</span><input type="range" min="0" max="1" step=".05" value="${values.effects}" data-setting="effects"></label>
    <label class="${settingClass}"><span>Mute audio</span><input type="checkbox" data-setting="muted" ${values.muted ? 'checked' : ''}></label>
  `
}

let sharedAudioManager

export function getAudioManager() {
  if (!sharedAudioManager) sharedAudioManager = createAudioManager()
  return sharedAudioManager
}
