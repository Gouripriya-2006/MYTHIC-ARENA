import { getCharacter } from '../game/data/characters.js'
import { canEquipItem, EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, getEquipmentStats } from './systems/equipment.js'
import { canUseItem, filterInventory, sortInventory } from './systems/inventory.js'
import { getItemDefinition, ITEM_RARITIES, MAX_INVENTORY_SLOTS } from './systems/inventoryItems.js'
import { CLASS_NAMES, getSkillBonuses, getSkillLockReason, SKILL_TREES } from './systems/skillTree.js'
import { getQuestAvailability, getQuestProgress, QUESTS } from './systems/quests.js'
import { TUTORIAL_STEPS } from './systems/tutorial.js'
import {
  getMerchantOffers,
  getPurchaseBlockReason,
  getSaleBlockReason,
  getSellPrice,
  MERCHANTS,
  MERCHANT_PRICES,
} from './systems/merchants.js'
import { getNpcOption, NPCS } from './systems/npcs.js'
import { renderAudioSettings } from '../audio/audioManager.js'
import { renderVoicePanel } from '../game/ui/VoicePanel.js'
import './rpgHud.css'

export function createPrototypeHud(root, progress, onAction) {
  const hud = document.createElement('section')
  hud.className = 'rpg-hud'
  hud.setAttribute('aria-label', 'The Lost Kingdom game HUD')
  hud.innerHTML = `
    <aside class="rpg-status-card">
      <div class="rpg-status-header"><span class="rpg-sigil">✦</span><div><strong data-hero-name></strong><small data-hero-class></small></div><b data-level></b></div>
      <div class="rpg-stat-label"><span>VITALITY</span><span data-health-text></span></div>
      <div class="rpg-stat-track"><i data-health-bar></i></div>
      <div class="rpg-stat-label rpg-stamina-label"><span>STAMINA</span><span data-stamina-text></span></div>
      <div class="rpg-stat-track rpg-stamina-track"><i data-stamina-bar></i></div>
      <div class="rpg-xp-label"><span>EXPERIENCE</span><span data-xp-text></span></div>
      <div class="rpg-stat-track rpg-xp-track"><i data-xp-bar></i></div>
      <div class="rpg-skill-points" data-skill-points hidden></div>
      <div class="rpg-hero-tags"><span data-gender></span><span data-model-status></span></div>
    </aside>
    <aside class="rpg-quest-card">
      <p class="rpg-hud-kicker" data-tracked-kicker>QUEST JOURNAL <span>TRACKED</span></p>
      <h2 data-tracked-name>NO QUEST TRACKED</h2>
      <p class="rpg-quest-subtitle" data-tracked-subtitle>Speak with the Veil Keeper to hear the kingdom’s tale.</p>
      <ol class="rpg-objectives" data-tracked-objectives></ol>
      <div class="rpg-enemy-meter" hidden>
        <div><span data-enemy-name>VEIL SENTINEL</span><small data-boss-phase hidden></small><b data-enemy-health-text></b></div>
        <div class="rpg-enemy-track"><i data-enemy-health></i></div>
        <p class="rpg-boss-warning" data-boss-warning hidden></p>
      </div>
    </aside>
    <button class="rpg-minimap" type="button" data-ui-action="map" aria-label="Open realm map">
      <span class="rpg-minimap-ring"></span><span class="rpg-minimap-temple">✦</span>
      <span class="rpg-minimap-relic">◈</span><span class="rpg-minimap-boss">◆</span><span class="rpg-minimap-player" data-minimap-player>▲</span>
      <small>REALM · MAP</small>
    </button>
    <div class="rpg-toast" role="status" aria-live="polite"></div>
    <button class="rpg-interaction-prompt" type="button" data-ui-action="interact" hidden><kbd>E</kbd><span data-prompt-label>INTERACT</span></button>
    <div class="rpg-shortcuts">
      <button type="button" data-ui-action="inventory"><kbd>I</kbd> INVENTORY</button>
      <button type="button" data-ui-action="journal"><kbd>L</kbd> JOURNAL</button>
      <button type="button" data-ui-action="map"><kbd>M</kbd> MAP</button>
      <button type="button" data-ui-action="skills"><kbd>U</kbd> SKILLS</button>
      <button type="button" data-ui-action="pause"><kbd>ESC</kbd> PAUSE</button>
    </div>
    <div class="rpg-cinematic" hidden>
      <p class="rpg-hud-kicker">MYTHIC · ARENA</p>
      <h2 data-cinematic-title></h2>
      <p data-cinematic-copy></p>
      <button type="button" data-ui-action="skip-cinematic">SKIP SEQUENCE <span>↗</span></button>
    </div>
    <aside class="rpg-tutorial-card" data-tutorial-card hidden aria-live="polite">
      <p class="rpg-hud-kicker" data-tutorial-progress></p>
      <h2 data-tutorial-title></h2>
      <p data-tutorial-description></p>
      <ul data-tutorial-guidance></ul>
      <div class="rpg-tutorial-confirmations" data-tutorial-confirmations></div>
      <div class="rpg-tutorial-actions">
        <button type="button" data-tutorial-action="back">BACK</button>
        <button type="button" data-tutorial-action="skip">SKIP TUTORIAL</button>
        <button type="button" data-tutorial-action="next">NEXT</button>
      </div>
    </aside>
    <div class="rpg-combat-actions" aria-label="Combat actions">
      <button type="button" data-ui-action="light-attack"><span>Ⅰ</span><b>LIGHT</b><kbd>J</kbd></button>
      <button type="button" data-ui-action="heavy-attack"><span>Ⅱ</span><b>HEAVY</b><kbd>K</kbd></button>
      <button type="button" data-ui-action="ability"><span>✦</span><b>ABILITY</b><kbd>Q</kbd></button>
      <button type="button" data-ui-action="block"><span>⬡</span><b>GUARD</b><kbd>B</kbd></button>
      <button type="button" data-ui-action="dodge"><span>↗</span><b>DODGE</b><kbd>CTRL</kbd></button>
    </div>
    <div class="rpg-mobile-controls">
      <div class="rpg-virtual-pad" aria-label="Touch movement">
        <button type="button" data-virtual-key="w" aria-label="Move forward">▲</button>
        <button type="button" data-virtual-key="a" aria-label="Move left">◀</button>
        <button type="button" data-virtual-key="s" aria-label="Move backward">▼</button>
        <button type="button" data-virtual-key="d" aria-label="Move right">▶</button>
      </div>
      <div class="rpg-mobile-actions">
        <button type="button" data-mobile-action="ability" aria-label="Class ability">ABILITY</button>
        <button type="button" data-mobile-action="dodge" aria-label="Dodge">DODGE</button>
        <button type="button" data-mobile-action="light-attack" aria-label="Light attack">STRIKE</button>
        <button type="button" data-mobile-action="heavy-attack" aria-label="Heavy attack">HEAVY</button>
        <button type="button" data-mobile-action="interact" aria-label="Interact">E</button>
        <button type="button" data-virtual-key="shift" aria-label="Hold to sprint">SPRINT</button>
        <button type="button" data-virtual-key="space" aria-label="Jump">JUMP</button>
        <button type="button" data-virtual-key="b" aria-label="Hold to guard">GUARD</button>
      </div>
    </div>
    <div class="rpg-panel-backdrop" hidden>
      <section class="rpg-menu-panel" role="dialog" aria-modal="true" aria-labelledby="rpg-panel-title">
        <button class="rpg-panel-close" type="button" aria-label="Close panel">×</button>
        <p class="rpg-hud-kicker">THE LOST KINGDOM</p>
        <h2 id="rpg-panel-title"></h2>
        <div class="rpg-panel-content"></div>
      </section>
    </div>
    <div class="rpg-result-backdrop" hidden>
      <section class="rpg-result-panel" role="dialog" aria-modal="true">
        <p class="rpg-hud-kicker">THE LOST KINGDOM</p>
        <h2 data-result-title></h2>
        <p class="rpg-result-subtitle" data-result-subtitle hidden></p>
        <p data-result-copy></p>
        <div data-result-reward></div>
        <button class="rpg-result-link" type="button" data-ui-action="recover-after-defeat" hidden>RETURN TO THE REALM <span>↗</span></button>
        <a class="rpg-result-link" data-result-home href="#/">RETURN TO THE REALM <span>↗</span></a>
      </section>
    </div>
  `
  root.append(hud)
  hud.insertAdjacentHTML('afterbegin', renderVoicePanel({ diagnostics: true, showTranscript: true }))

  const stateFields = {
    name: hud.querySelector('[data-hero-name]'),
    className: hud.querySelector('[data-hero-class]'),
    level: hud.querySelector('[data-level]'),
    healthText: hud.querySelector('[data-health-text]'),
    healthBar: hud.querySelector('[data-health-bar]'),
    staminaText: hud.querySelector('[data-stamina-text]'),
    staminaBar: hud.querySelector('[data-stamina-bar]'),
    xpText: hud.querySelector('[data-xp-text]'),
    xpBar: hud.querySelector('[data-xp-bar]'),
    gender: hud.querySelector('[data-gender]'),
    enemyMeter: hud.querySelector('.rpg-enemy-meter'),
    enemyHealth: hud.querySelector('[data-enemy-health]'),
    enemyHealthText: hud.querySelector('[data-enemy-health-text]'),
    result: hud.querySelector('.rpg-result-backdrop'),
    toast: hud.querySelector('.rpg-toast'),
  }
  const character = getCharacter(progress.getState().hero.classId)
  let toastTimer
  let pauseScreen = false
  let cinematicSkip = null
  let inventoryFilter = 'all'
  let inventorySort = 'rarity'
  let skillTreeClass = progress.getState().hero.classId
  let panelMode = 'regular'
  let activeMerchantId = null
  let merchantTab = 'buy'
  let pendingSale = null
  let activeDialogue = null
  let dialogueResponse = null
  hud.querySelector('[data-model-status]').textContent = 'LOADING HERO MODEL'

  function showMessage(message) {
    stateFields.toast.textContent = message
    stateFields.toast.classList.add('is-visible')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => stateFields.toast.classList.remove('is-visible'), 2600)
  }

  function renderPanel(type, focusClose = true) {
    pauseScreen = false
    panelMode = 'regular'
    activeMerchantId = null
    const state = progress.getState()
    const title = hud.querySelector('#rpg-panel-title')
    const content = hud.querySelector('.rpg-panel-content')
    title.textContent = type === 'inventory' ? 'Your Pack' : type === 'map' ? 'Realm Map' : type === 'skills' ? 'Path of Power' : 'Quest Journal'
    if (type === 'inventory') {
      const stats = getEquipmentStats(state.equipment)
      const slotNames = { mainHand: 'MAIN HAND', offHand: 'OFF HAND', armor: 'BODY', helmet: 'HEAD', gloves: 'HANDS', boots: 'FEET' }
      const items = sortInventory(filterInventory(state.inventory, inventoryFilter), inventorySort)
      content.innerHTML = `<p class="rpg-panel-lede">PACK <strong>${state.inventory.length} / ${MAX_INVENTORY_SLOTS} SLOTS</strong></p>
        <div class="rpg-inventory-toolbar"><label>FILTER <select data-inventory-filter><option value="all" ${inventoryFilter === 'all' ? 'selected' : ''}>All items</option><option value="weapon" ${inventoryFilter === 'weapon' ? 'selected' : ''}>Weapons</option><option value="armor" ${inventoryFilter === 'armor' ? 'selected' : ''}>Armor</option><option value="consumables" ${inventoryFilter === 'consumables' ? 'selected' : ''}>Consumables</option><option value="quest" ${inventoryFilter === 'quest' ? 'selected' : ''}>Quest</option><option value="materials" ${inventoryFilter === 'materials' ? 'selected' : ''}>Materials</option></select></label>
        <label>SORT <select data-inventory-sort><option value="rarity" ${inventorySort === 'rarity' ? 'selected' : ''}>Rarity</option><option value="name" ${inventorySort === 'name' ? 'selected' : ''}>Name</option><option value="type" ${inventorySort === 'type' ? 'selected' : ''}>Category</option></select></label></div>
        <div class="rpg-inventory-grid">${items.map((item) => {
        const gear = EQUIPMENT_BY_ID[item.id]
        const definition = getItemDefinition(item)
        const rarityClass = ITEM_RARITIES.includes(definition?.rarity) ? definition.rarity.toLowerCase() : 'common'
        const control = gear ? state.equipment[gear.slot] === gear.id
          ? `<small class="rpg-equipped-label">EQUIPPED</small><button type="button" data-unequip-slot="${gear.slot}">UNEQUIP</button>`
          : `<button type="button" data-equip-item="${gear.id}" ${canEquipItem(gear.id, state.hero.classId, state.inventory) ? '' : 'disabled'}>EQUIP</button>`
          : definition?.effect ? `<button type="button" data-use-item="${item.id}" ${canUseItem(state, item.id) ? '' : 'disabled'}>USE</button>` : ''
        const discard = definition && !gear && definition.category !== 'quest'
          ? `<button type="button" class="rpg-discard-button" data-discard-item="${escapeHtml(item.id)}">DISCARD</button>` : ''
        return `<article class="rpg-inventory-item rarity-${rarityClass}"><span>${escapeHtml(definition?.rarity ?? 'Common')}</span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.type.toUpperCase())}${item.quantity > 1 ? ` · ×${item.quantity}` : ''}</small><p>${escapeHtml(definition?.description ?? item.description ?? '')}</p><small class="rpg-item-stats">${escapeHtml(definition?.statText ?? '')}</small>${control}${discard}</article>`
      }).join('')}</div><h3 class="rpg-equipment-title">EQUIPPED</h3><p class="rpg-equipment-summary">${EQUIPMENT_SLOTS.map((slot) => `${slotNames[slot]}: ${escapeHtml(EQUIPMENT_BY_ID[state.equipment[slot]]?.name ?? 'EMPTY')}`).join(' · ')}</p><p class="rpg-panel-note">ATTACK +${stats.damage} · DEFENSE ${stats.defense} · MOVE ${Math.round(stats.movementMultiplier * 100)}% · GOLD ${state.gold}</p>`
    } else if (type === 'map') {
      const marker = (name, x, z, kind, visible = true) => `<span class="rpg-map-marker ${kind}" style="left:${Math.round((x + 68) / 136 * 100)}%;top:${Math.round((z + 68) / 136 * 100)}%;${visible ? '' : 'display:none'}" title="${name}">${kind === 'player' ? '▲' : kind === 'boss' ? '◆' : '✦'}</span>`
      content.innerHTML = `<div class="rpg-map"><span class="rpg-map-river"></span>
        ${marker('Veil Keeper', -4.4, -4.5, 'keeper')}
        ${marker('Bram Ironhand · Quartermaster', NPCS.quartermaster.position.x, NPCS.quartermaster.position.z, 'merchant')}
        ${marker('Lyra Thornbloom · Apothecary', NPCS.apothecary.position.x, NPCS.apothecary.position.z, 'apothecary')}
        ${marker('Eryn Vale · Pathfinder', NPCS.scout.position.x, NPCS.scout.position.z, 'scout')}
        ${marker('Sun Relic', 0, 9, 'relic', !state.objectives.relic)}
        ${marker('Veil Sentinel', 0, 24, 'sentinel', state.objectives.relic && !state.objectives.sentinel)}
        ${marker('Veil Warden', 0, 40, 'boss', state.objectives.sentinel && !state.objectives.boss)}
        ${marker('Ancient Gate', 0, 52, 'gate', state.objectives.boss)}
        ${marker('You', state.position.x, state.position.z, 'player')}
      </div><p class="rpg-panel-lede">SANCTUM DISTRICT <strong>YOU ARE HERE</strong></p>
      <p class="rpg-panel-note">Beyond the sealed gate, the Shattered Realm remains unexplored.</p>`
    } else if (type === 'skills') {
      const bonuses = getSkillBonuses(state)
      const tree = SKILL_TREES[skillTreeClass]
      const currentBonuses = [
        bonuses.maxHealth && `+${bonuses.maxHealth} maximum health`,
        bonuses.maxStamina && `+${bonuses.maxStamina} maximum stamina`,
        bonuses.meleeDamage && `+${Math.round(bonuses.meleeDamage * 100)}% melee damage`,
        bonuses.spellDamage && `+${Math.round(bonuses.spellDamage * 100)}% spell damage`,
        bonuses.heavyDamage && `+${Math.round(bonuses.heavyDamage * 100)}% heavy attack damage`,
        bonuses.abilityDamage && `+${Math.round(bonuses.abilityDamage * 100)}% ability damage`,
        bonuses.defense && `-${Math.round(bonuses.defense * 100)}% incoming damage`,
        bonuses.movementSpeed && `+${Math.round(bonuses.movementSpeed * 100)}% movement speed`,
        bonuses.criticalChance && `${Math.round(bonuses.criticalChance * 100)}% critical chance`,
        bonuses.cooldownReduction && `-${Math.round(bonuses.cooldownReduction * 100)}% ability cooldown`,
        bonuses.abilityRange && `+${bonuses.abilityRange}m ability range`,
        bonuses.abilityDuration && `+${bonuses.abilityDuration}s protection`,
        bonuses.shieldStrength && `+${Math.round(bonuses.shieldStrength * 100)}% block strength`,
        bonuses.counterDamage && `${Math.round(bonuses.counterDamage * 100)}% block counter damage`,
        bonuses.abilityCostReduction && `-${bonuses.abilityCostReduction} ability stamina cost`,
      ].filter(Boolean)
      content.innerHTML = `<div class="rpg-skill-overview">
          <p class="rpg-panel-lede">AVAILABLE SKILL POINTS <strong>${state.skillPoints}</strong></p>
          <p class="rpg-skill-ability">${escapeHtml(character.ability.name)} · ${escapeHtml(character.ability.description)}</p>
          <p class="rpg-skill-bonuses"><b>CURRENT BONUSES</b><span>${currentBonuses.length ? currentBonuses.map(escapeHtml).join(' · ') : 'No skill bonuses yet'}</span></p>
        </div>
        <nav class="rpg-skill-tabs" aria-label="Class skill trees">${Object.entries(CLASS_NAMES).map(([classId, className]) => `
          <button type="button" data-skill-tree-class="${classId}" class="${skillTreeClass === classId ? 'is-selected' : ''}"
            aria-pressed="${skillTreeClass === classId}">${escapeHtml(className)}${state.hero.classId === classId ? ' · YOUR PATH' : ''}</button>
        `).join('')}</nav>
        <section class="rpg-skill-tree" aria-label="${escapeHtml(CLASS_NAMES[skillTreeClass])} skill tree">
          <p class="rpg-skill-tree-heading">${escapeHtml(CLASS_NAMES[skillTreeClass])} PATH <span>LEVEL ${state.level}</span></p>
          <div class="rpg-skill-grid">${tree.map((skill) => {
        const unlocked = state.unlockedSkills.includes(skill.id)
        const lockReason = getSkillLockReason(state, skill.id)
        const disabled = Boolean(lockReason)
        const status = unlocked ? 'UNLOCKED' : state.hero.classId !== skill.classId ? 'CLASS LOCKED' : lockReason
        return `<article class="rpg-skill-card ${unlocked ? 'is-unlocked' : ''} ${state.hero.classId !== skill.classId ? 'is-class-locked' : ''}">
              <div><b>${escapeHtml(skill.name)}</b><span>${unlocked ? 'LEARNED' : `LV ${skill.level} · ${skill.cost} PT${skill.cost === 1 ? '' : 'S'}`}</span></div>
              <p>${escapeHtml(skill.description)}</p>
              <button type="button" data-skill="${skill.id}" ${disabled ? 'disabled' : ''}>${unlocked ? 'UNLOCKED' : status || `LEARN · ${skill.cost} PT${skill.cost === 1 ? '' : 'S'}`}</button>
            </article>`
      }).join('')}</div>
        </section>
        <p class="rpg-panel-note">Earn one skill point each time you level up. Class paths are exclusive; unlocked skills permanently improve combat and character stats.</p>`
    } else {
      const renderQuest = (quest) => {
        const status = state.questLog.completed.includes(quest.id)
          ? 'COMPLETED'
          : state.questLog.active.includes(quest.id)
            ? 'ACTIVE'
            : getQuestAvailability(state.questLog, quest.id)
              ? 'LOCKED'
              : 'AVAILABLE'
        const progress = getQuestProgress(state.questLog, quest)
        const tracked = state.questLog.trackedId === quest.id
        const rewards = [
          quest.rewards.xp && `${quest.rewards.xp} XP`,
          quest.rewards.gold && `${quest.rewards.gold} gold`,
          quest.rewards.skillPoints && `${quest.rewards.skillPoints} skill point${quest.rewards.skillPoints === 1 ? '' : 's'}`,
          ...(quest.rewards.items ?? []).map(({ itemId, quantity }) => `${quantity} ${getItemDefinition(itemId)?.name ?? itemId}`),
        ].filter(Boolean).join(' · ')
        const availability = getQuestAvailability(state.questLog, quest.id)
        const pendingItems = state.questLog.pendingItems[quest.id]
        const action = status === 'AVAILABLE'
          ? `<button type="button" data-accept-quest="${quest.id}">ACCEPT QUEST</button>`
          : state.questLog.active.includes(quest.id) || state.questLog.completed.includes(quest.id)
            ? `<button type="button" data-track-quest="${quest.id}">${tracked ? 'TRACKED' : 'TRACK QUEST'}</button>`
            : `<small class="rpg-quest-lock">${escapeHtml(availability)}</small>`
        return `<article class="rpg-journal-quest is-${status.toLowerCase()}">
          <div class="rpg-journal-quest-heading"><b>${escapeHtml(quest.name)}</b><span>${status}</span></div>
          <p>${escapeHtml(quest.description)}</p>
          <ol>${progress.map((objective) => `<li class="${objective.value >= objective.count ? 'is-complete' : ''}">
            <i>${objective.value >= objective.count ? '✓' : '◇'}</i><span>${escapeHtml(objective.label)}</span>
            <small>${objective.value} / ${objective.count}</small>
          </li>`).join('')}</ol>
          <p class="rpg-journal-rewards">REWARDS · ${escapeHtml(rewards)}</p>
          ${pendingItems?.length ? `<button type="button" data-claim-quest-items="${quest.id}">CLAIM ${pendingItems.reduce((sum, item) => sum + item.quantity, 0)} QUEST ITEM${pendingItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 'S'}</button>` : action}
        </article>`
      }
      content.innerHTML = `<div class="rpg-journal-header">
          <p class="rpg-panel-lede">QUEST JOURNAL <strong>${state.questLog.active.length} ACTIVE · ${state.questLog.completed.length} COMPLETE</strong></p>
          <p>Keeper: “The kingdom’s old paths still hold secrets. Choose a charge, Wayfarer.”</p>
        </div>
        <h3 class="rpg-equipment-title">THE LOST KINGDOM · MAIN STORY</h3>
        <div class="rpg-journal-quests">${QUESTS.filter(({ kind }) => kind === 'main').map(renderQuest).join('')}</div>
        <h3 class="rpg-equipment-title">THE KINGDOM’S CALLS · SIDE QUESTS</h3>
        <div class="rpg-journal-quests">${QUESTS.filter(({ kind }) => kind === 'side').map(renderQuest).join('')}</div>
        <p class="rpg-panel-note">Quest rewards are granted once on completion. If your pack is full, quest items remain here until claimed.</p>`
    }
    hud.querySelector('.rpg-panel-backdrop').hidden = false
    if (focusClose) onAction('tutorial-event', `${type}-open`)
    if (focusClose) hud.querySelector('.rpg-panel-close').focus()
  }

  function renderDialogue(npc) {
    panelMode = 'dialogue'
    activeMerchantId = null
    activeDialogue = npc
    dialogueResponse = null
    hud.querySelector('#rpg-panel-title').textContent = npc.name
    hud.querySelector('.rpg-panel-content').innerHTML = `
      <p class="rpg-panel-lede">REALM COMPANION <strong>${escapeHtml(npc.role)}</strong></p>
      <p class="rpg-npc-dialogue" data-npc-dialogue-text>${escapeHtml(npc.greeting)}</p>
      <div class="rpg-npc-options">${npc.options.map((option) => `
        <button type="button" data-npc-option="${escapeHtml(option.id)}">${escapeHtml(option.label)}</button>
      `).join('')}</div>
      <p class="rpg-panel-note">Choose a response to learn more, review your journal, or trade.</p>`
    hud.querySelector('.rpg-panel-backdrop').hidden = false
    hud.querySelector('.rpg-panel-close').focus()
  }

  function renderShop(focusClose = false) {
    const state = progress.getState()
    const merchant = MERCHANTS[activeMerchantId]
    if (!merchant) return
    panelMode = 'shop'
    hud.querySelector('#rpg-panel-title').textContent = merchant.name
    const content = hud.querySelector('.rpg-panel-content')
    const tabButtons = `<nav class="rpg-shop-tabs" aria-label="Merchant inventory">
      <button type="button" data-shop-tab="buy" class="${merchantTab === 'buy' ? 'is-selected' : ''}" aria-pressed="${merchantTab === 'buy'}">BUY</button>
      <button type="button" data-shop-tab="sell" class="${merchantTab === 'sell' ? 'is-selected' : ''}" aria-pressed="${merchantTab === 'sell'}">SELL</button>
    </nav>`
    if (merchantTab === 'buy') {
      const offers = getMerchantOffers(activeMerchantId)
      content.innerHTML = `<p class="rpg-panel-lede">AVAILABLE GOLD <strong data-shop-gold>${state.gold} ✦</strong></p>
        <p class="rpg-shop-instructions">Choose an item to add it to your pack. Unique equipment can only be purchased once.</p>
        ${tabButtons}
        <div class="rpg-inventory-grid">${offers.map(({ itemId, price, definition }) => {
        const reason = getPurchaseBlockReason(state, activeMerchantId, itemId)
        const stock = state.merchantStock[activeMerchantId][itemId]
        const rarity = ITEM_RARITIES.includes(definition.rarity) ? definition.rarity.toLowerCase() : 'common'
        return `<article class="rpg-inventory-item rarity-${rarity} rpg-merchant-item">
          <span>${escapeHtml(definition.rarity)}</span><b>${escapeHtml(definition.name)}</b>
          <small>${escapeHtml(definition.type.toUpperCase())} · STOCK ${stock}</small>
          <p>${escapeHtml(definition.description)}</p><small class="rpg-item-stats">${escapeHtml(definition.statText ?? '')}</small>
          <small class="rpg-merchant-price">${price} GOLD · SELL ${getSellPrice(itemId)}</small>
          ${reason ? `<small class="rpg-trade-status">${escapeHtml(reason)}</small>` : ''}
          <button type="button" data-buy-item="${escapeHtml(itemId)}" ${reason ? 'disabled' : ''}>${stock === 0 ? 'SOLD OUT' : `BUY · ${price} GOLD`}</button>
        </article>`
      }).join('')}</div>`
    } else {
      const items = state.inventory
      content.innerHTML = `<p class="rpg-panel-lede">AVAILABLE GOLD <strong data-shop-gold>${state.gold} ✦</strong></p>
        <p class="rpg-shop-instructions">Sell one item at a time for 45% of its listed value. Quest items and equipped gear are protected.</p>
        ${tabButtons}
        <div class="rpg-inventory-grid">${items.map((item) => {
        const definition = getItemDefinition(item)
        const price = getSellPrice(item.id)
        const reason = getSaleBlockReason(state, activeMerchantId, item.id)
        const rarity = ITEM_RARITIES.includes(definition?.rarity) ? definition.rarity.toLowerCase() : 'common'
        const isPending = pendingSale === item.id
        return `<article class="rpg-inventory-item rarity-${rarity} rpg-merchant-item">
          <span>${escapeHtml(definition?.rarity ?? 'Common')}</span><b>${escapeHtml(item.name)}</b>
          <small>${escapeHtml(item.type.toUpperCase())}${item.quantity > 1 ? ` · ×${item.quantity}` : ''}</small>
          <p>${escapeHtml(definition?.description ?? item.description ?? '')}</p>
          <small class="rpg-merchant-price">${price ? `SELL VALUE · ${price} GOLD EACH` : 'NOT ACCEPTED'}</small>
          ${reason ? `<small class="rpg-trade-status">${escapeHtml(reason)}</small>` : ''}
          ${isPending
            ? `<div class="rpg-sale-confirmation"><span>Sell one ${escapeHtml(item.name)} for ${price} gold?</span>
                <button type="button" data-confirm-sale>CONFIRM</button>
                <button type="button" data-cancel-sale>CANCEL</button></div>`
            : `<button type="button" data-sell-item="${escapeHtml(item.id)}" ${reason ? 'disabled' : ''}>SELL ONE · ${price || '—'} GOLD</button>`}
        </article>`
      }).join('') || '<p class="rpg-shop-empty">Your pack is empty.</p>'}</div>`
    }
    hud.querySelector('.rpg-panel-backdrop').hidden = false
    if (focusClose) hud.querySelector('.rpg-panel-close').focus()
  }

  function renderTutorial(tutorial) {
    const card = hud.querySelector('[data-tutorial-card]')
    const active = tutorial.status === 'active'
    card.hidden = !active
    root.querySelectorAll('.tutorial-highlight').forEach((element) => element.classList.remove('tutorial-highlight'))
    if (!active) return

    const step = TUTORIAL_STEPS[tutorial.step]
    hud.querySelector('[data-tutorial-progress]').textContent = `BEGINNER GUIDE · STEP ${tutorial.step + 1} OF ${TUTORIAL_STEPS.length}`
    hud.querySelector('[data-tutorial-title]').textContent = step.title
    hud.querySelector('[data-tutorial-description]').textContent = step.description
    hud.querySelector('[data-tutorial-guidance]').innerHTML = step.guidance
      .map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    hud.querySelector('[data-tutorial-confirmations]').innerHTML = step.requirements.length
      ? `<span>TRY IT</span><ul>${step.requirements.map((event) => {
        const label = event.replaceAll('-', ' ')
        const confirmed = tutorial.confirmations.includes(event)
        return `<li class="${confirmed ? 'is-confirmed' : ''}">${confirmed ? '✓' : '◇'} ${escapeHtml(label)}</li>`
      }).join('')}</ul>`
      : ''
    hud.querySelector('[data-tutorial-action="back"]').disabled = tutorial.step === 0
    hud.querySelector('[data-tutorial-action="next"]').textContent = tutorial.step === TUTORIAL_STEPS.length - 1
      ? 'FINISH'
      : 'NEXT'
    for (const selector of step.targets) {
      root.querySelectorAll(selector).forEach((element) => element.classList.add('tutorial-highlight'))
    }
  }

  function update(state) {
    const nextLevelXp = state.level * 100
    stateFields.name.textContent = state.hero.name
    stateFields.className.textContent = `${character.name.toUpperCase()} · ${character.epithet.toUpperCase()}`
    stateFields.level.textContent = `LV ${String(state.level).padStart(2, '0')}`
    stateFields.healthText.textContent = `${Math.ceil(state.health)} / ${state.maxHealth}`
    stateFields.healthBar.style.width = `${Math.max(0, state.health / state.maxHealth) * 100}%`
    stateFields.healthBar.classList.toggle('is-critical', state.health / state.maxHealth < 0.3)
    stateFields.staminaText.textContent = `${Math.floor(state.stamina)} / ${state.maxStamina}`
    stateFields.staminaBar.style.width = `${Math.max(0, state.stamina / state.maxStamina) * 100}%`
    stateFields.xpText.textContent = `${state.xp} / ${nextLevelXp}`
    stateFields.xpBar.style.width = `${Math.min(100, state.xp / nextLevelXp * 100)}%`
    stateFields.gender.textContent = `${state.hero.gender.toUpperCase()} · ${state.hero.appearance?.outfitId ?? 'SUNFORGED'}`
    const skillPoints = hud.querySelector('[data-skill-points]')
    skillPoints.hidden = state.skillPoints < 1
    skillPoints.textContent = `${state.skillPoints} SKILL POINT${state.skillPoints === 1 ? '' : 'S'} · U TO SPEND`
    hud.querySelector('.rpg-minimap-player').style.left = `${Math.max(4, Math.min(96, (state.position.x + 68) / 136 * 100))}%`
    hud.querySelector('.rpg-minimap-player').style.top = `${Math.max(4, Math.min(92, (state.position.z + 68) / 136 * 100))}%`
    const mapPlayer = hud.querySelector('.rpg-map-marker.player')
    if (mapPlayer) {
      mapPlayer.style.left = `${Math.round((state.position.x + 68) / 136 * 100)}%`
      mapPlayer.style.top = `${Math.round((state.position.z + 68) / 136 * 100)}%`
    }
    const activeEnemy = state.objectives.sentinel ? state.enemies.boss : state.enemies.sentinel
    stateFields.enemyMeter.hidden = !state.objectives.relic || (state.objectives.sentinel && state.objectives.boss)
    if (state.objectives.sentinel && !state.objectives.boss) {
      const phase = activeEnemy.health <= activeEnemy.maxHealth * 0.4 ? 3 : activeEnemy.health <= activeEnemy.maxHealth * 0.7 ? 2 : 1
      setEnemy('RAVANA · WARDEN OF THE VEIL', activeEnemy.health, activeEnemy.maxHealth, true, phase)
    } else if (!state.objectives.sentinel) setEnemy('VEIL SENTINEL', activeEnemy.health, activeEnemy.maxHealth, true)

    const trackedQuest = QUESTS.find(({ id }) => id === state.questLog.trackedId)
    renderTutorial(state.tutorial)
    hud.querySelector('[data-tracked-name]').textContent = trackedQuest?.name ?? 'NO QUEST TRACKED'
    hud.querySelector('[data-tracked-subtitle]').textContent = trackedQuest?.description ?? 'Speak with the Veil Keeper to hear the kingdom’s tale.'
    hud.querySelector('[data-tracked-kicker]').innerHTML = trackedQuest
      ? `${trackedQuest.kind === 'main' ? 'MAIN QUEST' : 'SIDE QUEST'} <span>${state.questLog.completed.includes(trackedQuest.id) ? 'COMPLETE' : 'TRACKED'}</span>`
      : 'QUEST JOURNAL <span>TRACKED</span>'
    hud.querySelector('[data-tracked-objectives]').innerHTML = trackedQuest
      ? getQuestProgress(state.questLog, trackedQuest).map((objective) => `<li class="${objective.value >= objective.count ? 'is-complete' : ''}">
          <i></i><span>${escapeHtml(objective.label)}</span><small>${objective.value}/${objective.count}</small>
        </li>`).join('')
      : ''
    const panelBackdrop = hud.querySelector('.rpg-panel-backdrop')
    if (!panelBackdrop.hidden && hud.querySelector('#rpg-panel-title').textContent === 'Quest Journal') {
      renderPanel('journal', false)
    }
    if (!panelBackdrop.hidden && panelMode === 'shop') renderShop()

    if (state.status === 'victory' || state.status === 'defeat') {
      hud.querySelector('.rpg-cutscene')?.setAttribute('hidden', '')
      stateFields.result.hidden = false
      stateFields.result.classList.toggle('is-victory', state.status === 'victory')
      hud.querySelector('[data-ui-action="recover-after-defeat"]').hidden = state.status !== 'defeat'
      hud.querySelector('[data-result-home]').hidden = state.status === 'defeat'
      hud.querySelector('[data-result-title]').textContent = state.status === 'victory' ? 'YOU WIN THE GAME!' : 'THE VEIL CLOSES'
      const subtitle = hud.querySelector('[data-result-subtitle]')
      subtitle.hidden = state.status !== 'victory'
      subtitle.textContent = state.status === 'victory' ? 'THE LOST KINGDOM HAS BEEN RESTORED.' : ''
      hud.querySelector('[data-result-copy]').textContent = state.status === 'victory'
        ? 'You have defeated the Warden of the Veil and restored the kingdom.'
        : 'Your strength has faded. Your progress is saved; return when you are ready.'
      hud.querySelector('[data-result-reward]').textContent = `LEVEL ${state.level}  ·  ${state.gold} GOLD  ·  ${state.inventory.length} ITEMS`
    } else stateFields.result.hidden = true
  }

  function setEnemy(name, health, maxHealth, visible, bossPhase = null, warning = null) {
    stateFields.enemyMeter.hidden = !visible
    hud.querySelector('[data-enemy-name]').textContent = name
    stateFields.enemyHealth.style.width = `${Math.max(0, health / maxHealth) * 100}%`
    stateFields.enemyHealthText.textContent = `${health} / ${maxHealth}`
    const phaseIndicator = hud.querySelector('[data-boss-phase]')
    phaseIndicator.hidden = bossPhase === null
    phaseIndicator.textContent = bossPhase === null ? '' : `PHASE ${['', 'I', 'II', 'III'][bossPhase]} / III`
    const warningIndicator = hud.querySelector('[data-boss-warning]')
    warningIndicator.hidden = !warning
    warningIndicator.textContent = warning ?? ''
  }

  const onClick = (event) => {
    const tutorialAction = event.target.closest('[data-tutorial-action]')?.dataset.tutorialAction
    if (tutorialAction) {
      event.target.closest('button')?.blur()
      onAction(`tutorial-${tutorialAction}`)
      return
    }
    const shopTab = event.target.closest('[data-shop-tab]')?.dataset.shopTab
    if (shopTab) {
      merchantTab = shopTab
      pendingSale = null
      renderShop()
      return
    }
    const buyItem = event.target.closest('[data-buy-item]')?.dataset.buyItem
    if (buyItem) {
      onAction('buy-item', { merchantId: activeMerchantId, itemId: buyItem })
      return
    }
    const sellItem = event.target.closest('[data-sell-item]')?.dataset.sellItem
    if (sellItem) {
      pendingSale = sellItem
      renderShop()
      return
    }
    if (event.target.closest('[data-confirm-sale]')) {
      const itemId = pendingSale
      pendingSale = null
      if (itemId) onAction('sell-item', { merchantId: activeMerchantId, itemId })
      return
    }
    if (event.target.closest('[data-cancel-sale]')) {
      pendingSale = null
      renderShop()
      return
    }
    if (event.target.closest('[data-dialogue-back]')) {
      dialogueResponse = null
      renderDialogue(activeDialogue)
      return
    }
    const dialogueOptionId = event.target.closest('[data-npc-option]')?.dataset.npcOption
    if (dialogueOptionId && activeDialogue) {
      const option = getNpcOption(activeDialogue.id, dialogueOptionId)
      if (!option) return
      if (!option.action) {
        dialogueResponse = option.response
        const content = hud.querySelector('.rpg-panel-content')
        content.innerHTML = `<p class="rpg-panel-lede">REALM COMPANION <strong>${escapeHtml(activeDialogue.role)}</strong></p>
          <p class="rpg-npc-dialogue" data-npc-dialogue-text>${escapeHtml(dialogueResponse)}</p>
          <button type="button" class="rpg-resume-button" data-dialogue-back>ASK SOMETHING ELSE</button>`
      } else {
        onAction('npc-option', { npcId: activeDialogue.id, optionId: dialogueOptionId })
      }
      return
    }
    if (event.target.closest('[data-ui-action="skip-cinematic"]')) {
      cinematicSkip?.()
      return
    }
    if (event.target.closest('.rpg-panel-close')) {
      if (pauseScreen) onAction('pause')
      else if (panelMode === 'dialogue' || panelMode === 'shop') onAction('close-overlay')
      else hud.querySelector('.rpg-panel-backdrop').hidden = true
      return
    }
    const action = event.target.closest('[data-ui-action]')?.dataset.uiAction
    if (action) onAction(action)
    const treeClass = event.target.closest('[data-skill-tree-class]')?.dataset.skillTreeClass
    if (treeClass && CLASS_NAMES[treeClass]) {
      skillTreeClass = treeClass
      renderPanel('skills', false)
      return
    }
    const mobileAction = event.target.closest('[data-mobile-action]')?.dataset.mobileAction
    if (mobileAction) onAction(mobileAction)
    const skillId = event.target.closest('[data-skill]')?.dataset.skill
    if (skillId) onAction('purchase-skill', skillId)
    const acceptQuest = event.target.closest('[data-accept-quest]')?.dataset.acceptQuest
    if (acceptQuest) onAction('accept-quest', acceptQuest)
    const trackQuest = event.target.closest('[data-track-quest]')?.dataset.trackQuest
    if (trackQuest) onAction('track-quest', trackQuest)
    const claimQuestItems = event.target.closest('[data-claim-quest-items]')?.dataset.claimQuestItems
    if (claimQuestItems) onAction('claim-quest-items', claimQuestItems)
    const equipItem = event.target.closest('[data-equip-item]')?.dataset.equipItem
    if (equipItem) onAction('equip-item', equipItem)
    const unequipSlot = event.target.closest('[data-unequip-slot]')?.dataset.unequipSlot
    if (unequipSlot) onAction('unequip-item', unequipSlot)
    const useItem = event.target.closest('[data-use-item]')?.dataset.useItem
    if (useItem) onAction('use-item', useItem)
    const discardItem = event.target.closest('[data-discard-item]')?.dataset.discardItem
    if (discardItem) onAction('discard-item', discardItem)
  }
  const onVirtualDown = (event) => {
    const button = event.target.closest('[data-virtual-key]')
    if (!button) return
    event.preventDefault()
    button.setPointerCapture?.(event.pointerId)
    onAction('virtual-key', button.dataset.virtualKey, true)
  }
  const onVirtualUp = (event) => {
    const button = event.target.closest('[data-virtual-key]')
    if (button) onAction('virtual-key', button.dataset.virtualKey, false)
  }
  const onEscape = (event) => {
    const key = event.key.toLowerCase()
    if (key === 'escape' && !hud.querySelector('.rpg-cinematic').hidden) {
      cinematicSkip?.()
    } else if (key === 'escape') {
      if (!hud.querySelector('.rpg-panel-backdrop').hidden) {
        if (pauseScreen) onAction('pause')
        else if (panelMode === 'dialogue' || panelMode === 'shop') onAction('close-overlay')
        else hud.querySelector('.rpg-panel-backdrop').hidden = true
      }
      else onAction('pause')
    } else if (key === 'i' && hud.querySelector('.rpg-panel-backdrop').hidden) {
      renderPanel('inventory')
    } else if (key === 'l' && hud.querySelector('.rpg-panel-backdrop').hidden) {
      renderPanel('journal')
    } else if (key === 'm' && hud.querySelector('.rpg-panel-backdrop').hidden) {
      renderPanel('map')
    } else if (key === 'u' && hud.querySelector('.rpg-panel-backdrop').hidden) {
      renderPanel('skills')
    }
  }
  const onSettingInput = (event) => {
    if (event.target.dataset.inventoryFilter) {
      inventoryFilter = event.target.value
      renderPanel('inventory', false)
      return
    }
    if (event.target.dataset.inventorySort) {
      inventorySort = event.target.value
      renderPanel('inventory', false)
      return
    }
    const setting = event.target.dataset.setting
    if (!setting) return
    const current = progress.getState().settings
    progress.dispatch({
      type: 'update-settings',
      settings: { ...current, [setting]: event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value) },
    }, { persist: true })
  }
  hud.addEventListener('click', onClick)
  hud.addEventListener('pointerdown', onVirtualDown)
  hud.addEventListener('pointerup', onVirtualUp)
  hud.addEventListener('pointercancel', onVirtualUp)
  hud.addEventListener('lostpointercapture', onVirtualUp)
  hud.addEventListener('input', onSettingInput)
  hud.addEventListener('change', onSettingInput)
  window.addEventListener('keydown', onEscape)
  const unsubscribe = progress.subscribe(update)
  update(progress.getState())

  return {
    showMessage,
    setEnemy,
    showCinematic(title, copy, onSkip) {
      cinematicSkip = onSkip
      hud.querySelector('[data-cinematic-title]').textContent = title
      hud.querySelector('[data-cinematic-copy]').textContent = copy
      hud.querySelector('.rpg-cinematic').hidden = false
      requestAnimationFrame(() => hud.querySelector('.rpg-cinematic').classList.add('is-visible'))
    },
    hideCinematic() {
      const cinematic = hud.querySelector('.rpg-cinematic')
      cinematic.classList.remove('is-visible')
      cinematic.hidden = true
      cinematicSkip = null
    },
    setPrompt(label) {
      const prompt = hud.querySelector('.rpg-interaction-prompt')
      prompt.hidden = !label
      hud.querySelector('[data-prompt-label]').textContent = label ?? ''
    },
    openDialogue(npc) {
      if (!npc || !NPCS[npc.id]) return
      renderDialogue(NPCS[npc.id])
    },
    openShop(merchantId) {
      if (!MERCHANTS[merchantId]) return
      activeMerchantId = merchantId
      merchantTab = 'buy'
      pendingSale = null
      renderShop(true)
    },
    closePanel() {
      hud.querySelector('.rpg-panel-backdrop').hidden = true
      panelMode = 'regular'
      activeDialogue = null
      activeMerchantId = null
    },
    setModelStatus(status) {
      hud.querySelector('[data-model-status]').textContent = status === 'loaded'
        ? 'HERO MODEL'
        : status === 'primitive'
          ? 'LOW-POLY HERO'
        : status === 'incomplete'
          ? 'ANIMATIONS INCOMPLETE'
        : status === 'loading'
          ? 'LOADING HERO MODEL'
          : 'RIG PLACEHOLDER'
      hud.classList.toggle('has-model', status === 'loaded' || status === 'incomplete' || status === 'primitive')
    },
    setPaused(paused, onResume) {
      pauseScreen = paused
      const button = hud.querySelector('[data-ui-action="pause"]')
      button.innerHTML = paused ? '<kbd>ESC</kbd> RESUME' : '<kbd>ESC</kbd> PAUSE'
      if (paused) {
        hud.querySelector('#rpg-panel-title').textContent = 'Realm Paused'
        const settings = progress.getState().settings
        hud.querySelector('.rpg-panel-content').innerHTML = `
          <p>Progress and audio preferences are saved on this device.</p>
          <div class="rpg-audio-notice">Procedural music and sound effects use Web Audio. Start or resume playback with any game control.</div>
          ${renderAudioSettings(settings)}
          <button type="button" class="rpg-resume-button" data-ui-action="replay-tutorial">Replay Beginner Tutorial</button>
          <button class="rpg-resume-button rpg-return-button" type="button">Return to the realm</button>
        `
        hud.querySelector('.rpg-panel-backdrop').hidden = false
        hud.querySelector('.rpg-return-button').addEventListener('click', onResume, { once: true })
      } else {
        hud.querySelector('.rpg-panel-backdrop').hidden = true
      }
    },
    openPanel: renderPanel,
    destroy() {
      clearTimeout(toastTimer)
      unsubscribe()
      hud.removeEventListener('click', onClick)
      hud.removeEventListener('pointerdown', onVirtualDown)
      hud.removeEventListener('pointerup', onVirtualUp)
      hud.removeEventListener('pointercancel', onVirtualUp)
      hud.removeEventListener('lostpointercapture', onVirtualUp)
      hud.removeEventListener('input', onSettingInput)
      hud.removeEventListener('change', onSettingInput)
      window.removeEventListener('keydown', onEscape)
      hud.querySelector('.rpg-cinematic').hidden = true
      hud.remove()
    },
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}
