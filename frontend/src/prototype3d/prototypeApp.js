import { Engine } from '@babylonjs/core/Engines/engine.js'
import { getAudioManager } from '../audio/audioManager.js'
import { createVoiceController } from '../game/ai/gnani/voiceController.js'
import { createBabylonVoiceActionDispatcher } from './voiceActionDispatcher.js'
import { executeBabylonVoiceIntent } from './voiceActionExecutor.js'
import { createArenaScene } from './arenaScene.js'
import { createPrototypeHud } from './prototypeHud.js'
import { createRpgProgressStore, loadProgress, SAVE_KEY } from './systems/rpgProgression.js'
import { getSkillLockReason } from './systems/skillTree.js'
import { getQuestAvailability, QUESTS_BY_ID } from './systems/quests.js'
import { getItemDefinition } from './systems/inventoryItems.js'
import { getNpcOption } from './systems/npcs.js'
import { archiveCurrentSave, shouldStartNewAdventure } from './systems/adventureMode.js'
import {
  getPurchaseBlockReason,
  getSaleBlockReason,
  getSellPrice,
  MERCHANT_PRICES,
} from './systems/merchants.js'
import './prototype.css'
import '../game/ui/game.css'

export function mountPrototypeApp() {
  const hash = window.location.hash
  const query = new URLSearchParams(hash.slice(hash.indexOf('?') + 1))
  const requestedNewAdventure = query.get('new') === '1'
  const existingProgress = requestedNewAdventure ? loadProgress(globalThis.localStorage) : null
  let newAdventure = shouldStartNewAdventure(requestedNewAdventure, existingProgress)
  let archiveError = false
  if (newAdventure) {
    try {
      archiveCurrentSave(globalThis.localStorage, SAVE_KEY)
    } catch (error) {
      console.error('Unable to preserve the existing 3D save before starting a new adventure.', error)
      newAdventure = false
      archiveError = true
    }
  }
  if (requestedNewAdventure) {
    const route = `${window.location.pathname}${window.location.search}#/3d-prototype`
    window.history.replaceState(window.history.state, '', route)
  }
  const hero = readHeroSelection()
  let hud
  const progressStorage = archiveError && !existingProgress ? null : globalThis.localStorage
  const progress = createRpgProgressStore(hero, progressStorage, {
    loadSaved: !newAdventure,
    onPersistenceError: () => hud?.showMessage('Progress could not be saved in this browser. Your current session is still active.'),
  })
  const audio = getAudioManager()
  const audioSettings = newAdventure ? audio.getSettings() : progress.getState().settings
  audio.updateSettings(audioSettings)
  if (newAdventure) {
    progress.dispatch({ type: 'update-settings', settings: audioSettings }, { persist: true })
  }
  const recordTutorialEvent = (event) => {
    const previous = progress.getState()
    const next = progress.dispatch({ type: 'tutorial-event', event }, { persist: true })
    return next !== previous
  }
  const root = document.createElement('main')
  root.className = 'prototype-root'
  root.innerHTML = `
    <canvas class="prototype-canvas" aria-label="Interactive third-person fantasy arena"></canvas>
    <div class="prototype-vignette" aria-hidden="true"></div>
    <header class="prototype-header">
      <a class="prototype-brand" href="#/" aria-label="Return to Mythic Arena">
        <span class="prototype-brand-mark" aria-hidden="true">✦</span>
        <span>MYTHIC<span class="prototype-brand-divider">·</span>ARENA</span>
      </a>
      <div class="prototype-chapter"><span>FIRST CHRONICLE</span><i></i> THE LOST KINGDOM</div>
      <a class="prototype-exit" href="#/">EXIT PROTOTYPE <span aria-hidden="true">↗</span></a>
    </header>
    <section class="prototype-intro" aria-label="Prototype introduction">
      <p class="prototype-kicker"><span></span> AN ISOLATED 3D PLAYGROUND <span></span></p>
      <h1>The Lost <em>Kingdom</em></h1>
      <p class="prototype-description">Recover the Sun Relic. Face the Veil Sentinel. Open the ancient gate.</p>
    </section>
    <div class="prototype-bottom">
      <div class="prototype-controls" aria-label="Game controls">
        <div class="prototype-move-keys"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div>
        <span>MOVE</span><kbd>SHIFT</kbd><span>SPRINT</span><kbd>SPACE</kbd><span>JUMP</span>
        <i></i>
        <span class="prototype-control-note">DRAG TO LOOK <b>·</b> SCROLL TO ZOOM <b>·</b> E INTERACT <b>·</b> J/K ATTACK</span>
      </div>
    </div>
    <div class="prototype-loading" role="status">AWAKENING THE REALM<span>...</span></div>
    <div class="prototype-error" role="alert" hidden>3D rendering is unavailable in this browser.</div>
  `
  document.body.append(root)
  document.body.classList.add('prototype-mode')

  const canvas = root.querySelector('.prototype-canvas')
  const loading = root.querySelector('.prototype-loading')
  const error = root.querySelector('.prototype-error')
  let arena
  let voiceController
  let engine
  let dodgeTimeout
  let disposed = false

  try {
    engine = new Engine(canvas, true, {
      antialias: true,
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: true,
    })
    const handleHudAction = (action, value, pressed) => {
      const controller = arena?.controller
      if (action === 'virtual-key') controller?.setVirtualKey(value, pressed)
      else if (action === 'light-attack') controller?.startAttack('light')
      else if (action === 'heavy-attack') controller?.startAttack('heavy')
      else if (action === 'ability') controller?.triggerAbility()
      else if (action === 'interact') controller?.setVirtualKey('e', true)
      else if (action === 'block') controller?.setVirtualKey('b', !controller?.isBlocking())
      else if (action === 'skip-cinematic') arena?.skipCinematic()
      else if (action === 'recover-after-defeat') {
        const previous = progress.getState()
        const next = progress.dispatch({ type: 'resume-after-defeat' }, { persist: true })
        if (next === previous) return { ok: false, error: 'The saved realm is not awaiting defeat recovery.' }
        controller?.setPaused(false)
        hud.setPaused(false)
        hud.showMessage('You have returned to the realm. Your progress is intact.')
        return { ok: true }
      }
      else if (action === 'equip-item' || action === 'unequip-item') {
        const previous = progress.getState()
        const next = progress.dispatch(action === 'equip-item'
          ? { type: 'equip-item', itemId: value }
          : { type: 'unequip-item', slot: value }, { persist: true })
        if (next === previous) hud.showMessage('That item cannot be equipped by this class.')
        else {
          recordTutorialEvent(action === 'equip-item' ? 'equipment-equipped' : 'equipment-unequipped')
          arena?.character.applyEquipment(next.equipment)
          hud.openPanel('inventory')
        }
      }
      else if (action === 'use-item' || action === 'discard-item') {
        const previous = progress.getState()
        const next = progress.dispatch(action === 'use-item'
          ? { type: 'use-item', itemId: value }
          : { type: 'discard-item', itemId: value }, { persist: true })
        if (next === previous) hud.showMessage(action === 'use-item' ? 'You cannot use that item right now.' : 'That item cannot be discarded.')
        else {
          const used = action === 'use-item'
          recordTutorialEvent(value === 'health-potion' ? 'health-potion' : 'stamina-potion')
          hud.showMessage(used ? `${value === 'health-potion' ? 'Health' : 'Mana'} Potion used.` : 'Item discarded.')
          hud.openPanel('inventory')
        }
      }
      else if (action === 'purchase-skill') {
        const previous = progress.getState()
        const next = progress.dispatch({ type: 'purchase-skill', skillId: value }, { persist: true })
        if (next !== previous) {
          recordTutorialEvent('skill-purchased')
          hud.openPanel('skills')
        }
        else hud.showMessage(`Skill unavailable: ${getSkillLockReason(previous, value) || 'requirements not met'}.`)
      } else if (action === 'accept-quest') {
        const previous = progress.getState()
        const next = progress.dispatch({
          type: 'accept-quest',
          questId: value,
          npcId: QUESTS_BY_ID[value]?.giverId ?? 'keeper',
        }, { persist: true })
        if (next !== previous) {
          recordTutorialEvent('quest-accepted')
          hud.showMessage('Quest accepted. Your journal has been updated.')
          hud.openPanel('journal')
        } else hud.showMessage(getQuestAvailability(previous.questLog, value))
      } else if (action === 'track-quest') {
        const current = progress.getState().questLog.trackedId
        const previous = progress.getState()
        const next = progress.dispatch({ type: 'track-quest', questId: current === value ? null : value }, { persist: true })
        if (next !== previous && current !== value) recordTutorialEvent('quest-tracked')
        hud.openPanel('journal')
      } else if (action === 'claim-quest-items') {
        const previous = progress.getState()
        const next = progress.dispatch({ type: 'claim-quest-items', questId: value }, { persist: true })
        if (next === previous) hud.showMessage('Make room in your pack before claiming quest items.')
        else {
          hud.showMessage('Quest rewards claimed.')
          hud.openPanel('journal')
        }
      } else if (action === 'buy-item') {
        const previous = progress.getState()
        const { merchantId, itemId } = value
        const reason = getPurchaseBlockReason(previous, merchantId, itemId)
        const next = progress.dispatch({ type: 'buy-item', merchantId, itemId }, { persist: true })
        if (next === previous) hud.showMessage(reason || 'That purchase could not be completed.')
        else hud.showMessage(`Purchased ${getItemDefinition(itemId)?.name ?? itemId} for ${MERCHANT_PRICES[itemId]} gold.`)
      } else if (action === 'sell-item') {
        const previous = progress.getState()
        const { merchantId, itemId } = value
        const reason = getSaleBlockReason(previous, merchantId, itemId)
        const next = progress.dispatch({ type: 'sell-item', merchantId, itemId }, { persist: true })
        if (next === previous) hud.showMessage(reason || 'That sale could not be completed.')
        else hud.showMessage(`Sold ${getItemDefinition(itemId)?.name ?? itemId} for ${getSellPrice(itemId)} gold.`)
      } else if (action === 'npc-option') {
        const option = getNpcOption(value.npcId, value.optionId)
        if (option?.action === 'shop') hud.openShop(option.merchantId)
        else if (option?.action === 'journal' || option?.action === 'map') {
          controller?.setPaused(false)
          hud.closePanel()
          hud.openPanel(option.action)
        } else if (option?.action === 'close') {
          controller?.setPaused(false)
          hud.closePanel()
        }
      } else if (action === 'close-overlay') {
        controller?.setPaused(false)
        hud.closePanel()
      } else if (action === 'update-settings') {
        const settings = audio.updateSettings(value)
        progress.dispatch({ type: 'update-settings', settings }, { persist: true })
      }
      else if (action === 'tutorial-event') {
        return recordTutorialEvent(value)
      } else if (action === 'tutorial-next' || action === 'tutorial-back' || action === 'tutorial-skip') {
        const command = action.replace('tutorial-', '')
        progress.dispatch({ type: `tutorial-${command}` }, { persist: true })
      } else if (action === 'replay-tutorial') {
        controller?.setPaused(false)
        hud.setPaused(false)
        progress.dispatch({ type: 'tutorial-replay' }, { persist: true })
      }
      else if (action === 'dodge') {
        controller?.setVirtualKey('control', true)
        clearTimeout(dodgeTimeout)
        dodgeTimeout = setTimeout(() => controller?.setVirtualKey('control', false), 60)
      } else if (action === 'inventory' || action === 'journal' || action === 'map' || action === 'skills') {
        hud.openPanel(action)
      } else if (action === 'pause') {
        const paused = controller?.setPaused(!controller.isPaused()) ?? false
        hud.setPaused(paused, () => {
          controller?.setPaused(false)
          hud.setPaused(false)
        })
      }
    }
    const safelyHandleHudAction = (...args) => {
      try {
        return handleHudAction(...args)
      } catch (error) {
        console.error('A 3D game action failed.', error)
        hud?.showMessage('That action could not be completed. You can continue playing.')
        return { ok: false, error: 'The game action failed safely.' }
      }
    }
    hud = createPrototypeHud(root, progress, safelyHandleHudAction)
    if (requestedNewAdventure && archiveError) hud.showMessage('A new adventure could not safely replace the existing save. The saved realm was preserved.')
    else if (requestedNewAdventure && existingProgress && newAdventure) hud.showMessage('Your previous save was archived. A fresh adventure has begun.')
    arena = createArenaScene(engine, canvas, progress, hud, recordTutorialEvent, audio)
    const voiceDispatcher = createBabylonVoiceActionDispatcher({
      getState: () => progress.getState(),
      canExecute: (intent, state) => arena?.canExecuteVoiceAction(intent, state) ?? false,
      getRejectionReason: (intent, state) => arena?.getVoiceActionRejection(intent, state),
      execute: (intent) => executeBabylonVoiceIntent(intent, {
        arena,
        handleHudAction: (action, itemId) => {
          const before = progress.getState()
          const result = safelyHandleHudAction(action, itemId)
          return result?.ok === false
            ? result
            : progress.getState() !== before
              ? { ok: true, actionResult: `${itemId} used successfully.` }
              : { ok: false, error: result?.error || 'The item could not be used in the current state.' }
        },
      }),
    })
    voiceController = createVoiceController(root, {
      game: 'babylon-3d',
      onMessage: (message) => hud?.showMessage(message),
      onIntent: (intent) => {
        const result = voiceDispatcher.dispatch(intent)
        if (!result.ok) hud?.showMessage(result.error)
        return result
      },
      play: (blob, options) => audio.playAudioBlob(blob, options),
    })
    engine.runRenderLoop(() => {
      if (!disposed) engine.scenes[0]?.render()
    })
    arena.ready.then(() => {
      if (!disposed && arena.character.modelType === 'primitive') {
        hud.setModelStatus('primitive')
      } else if (!disposed && !arena.character.isAssetLoaded) {
        hud.setModelStatus('fallback')
        hud.showMessage('Humanoid GLB not installed. Showing the clearly labeled animated prototype rig.')
      } else if (!disposed && arena.character.missingMotions.length) {
        hud.setModelStatus('incomplete')
        hud.showMessage(`Character model is missing animation clips: ${arena.character.missingMotions.join(', ')}.`)
      }
    })
    loading.classList.add('is-hidden')
  } catch (renderError) {
    console.error('Unable to initialize the 3D prototype.', renderError)
    error.hidden = false
    loading.classList.add('is-hidden')
  }

  const onResize = () => engine?.resize()
  window.addEventListener('resize', onResize)

  return () => {
    disposed = true
    clearTimeout(dodgeTimeout)
    window.removeEventListener('resize', onResize)
    arena?.dispose()
    voiceController?.destroy()
    hud?.destroy()
    try {
      progress.save()
    } catch (saveError) {
      console.error('Unable to save 3D RPG progress.', saveError)
    }
    engine?.dispose()
    document.body.classList.remove('prototype-mode')
    root.remove()
  }
}

function readHeroSelection() {
  const selectionKey = 'mythic-arena-3d-hero'
  const serialized = sessionStorage.getItem(selectionKey)
  if (!serialized) return undefined
  sessionStorage.removeItem(selectionKey)
  try {
    return JSON.parse(serialized)
  } catch (error) {
    console.warn('Saved hero selection is invalid; using the default prototype hero.', error)
    return undefined
  }
}
