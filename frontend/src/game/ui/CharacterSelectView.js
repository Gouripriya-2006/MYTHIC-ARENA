import { appearanceOptions, characters, defaultAppearance } from '../data/characters.js'
import { lostKingdom } from '../data/missions/lostKingdom.js'
import { bindClassSelection } from './classSelection.js'

const isCharacterId = (id) => characters.some((character) => character.id === id)

export function renderCharacterSelectView(root, preselectedCharacterId, onStart) {
  let selectedClassId = isCharacterId(preselectedCharacterId) ? preselectedCharacterId : null
  const hero = {
    name: '',
    gender: 'male',
    appearance: { ...defaultAppearance },
  }

  root.innerHTML = `
    <main class="game-shell select-shell creation-shell">
      <header class="game-topbar">
        <a class="game-brand" href="#home"><span class="game-brand-symbol">✦</span> MYTHIC<span>·</span>ARENA</a>
        <a class="game-exit-link" href="#home">Return to the realm <span aria-hidden="true">↗</span></a>
      </header>
      <section class="creation-screen" aria-labelledby="creation-title">
        <div class="creation-heading">
          <p class="game-eyebrow"><span></span> First mission · The Shattered Veil</p>
          <h1 id="creation-title">Create your <em>hero.</em></h1>
          <p class="creation-intro">The old kingdom is calling. Shape the champion who will answer.</p>
        </div>
        <form class="creation-form" novalidate>
          <section class="creation-identity" aria-label="Hero appearance">
            <div class="hero-preview-panel">
              <span class="preview-corner preview-corner-tl"></span><span class="preview-corner preview-corner-br"></span>
              <p class="preview-label">YOUR REFLECTION</p>
              <div class="hero-preview" data-gender="male" data-face="wanderer" data-hair="long"
                style="--skin-color: #b87951; --outfit-color: #b4874e; --outfit-accent: #e7c77f; --hero-accent: #c8a667">
                <span class="preview-aura"></span>
                <span class="preview-cape"></span>
                <span class="preview-hair"></span>
                <span class="preview-head"><i class="preview-eye preview-eye-left"></i><i class="preview-eye preview-eye-right"></i><i class="preview-face-mark"></i></span>
                <span class="preview-neck"></span>
                <span class="preview-body"></span>
                <span class="preview-shoulder preview-shoulder-left"></span><span class="preview-shoulder preview-shoulder-right"></span>
                <span class="preview-belt"></span>
                <span class="preview-weapon"></span>
              </div>
              <div class="preview-caption">
                <span class="preview-class">Choose a class</span>
                <strong class="preview-name">Your hero</strong>
                <span class="preview-epithet">THE LOST KINGDOM AWAITS</span>
              </div>
              <span class="preview-coordinate">THE SHATTERED VEIL · 01</span>
            </div>
            <div class="creation-options">
              <label class="creation-label" for="hero-name">Hero name <span>REQUIRED</span></label>
              <input id="hero-name" class="hero-name-input" type="text" name="heroName" maxlength="24"
                autocomplete="off" placeholder="Name your legend" aria-describedby="hero-name-error">
              <p id="hero-name-error" class="field-error" role="alert"></p>

              <fieldset class="creation-fieldset gender-fieldset">
                <legend class="creation-label">Appearance <span>GENDER</span></legend>
                <div class="gender-options" role="group" aria-label="Gender">
                  <button class="gender-option is-active" type="button" data-gender="male" aria-pressed="true">Male</button>
                  <button class="gender-option" type="button" data-gender="female" aria-pressed="false">Female</button>
                </div>
              </fieldset>

              <fieldset class="creation-fieldset">
                <legend class="creation-label">Face <span>PRESET</span></legend>
                <div class="face-options" role="group" aria-label="Face preset">
                  ${appearanceOptions.faces.map((face, index) => `
                    <button class="face-option${index === 0 ? ' is-active' : ''}" type="button" data-face="${face.id}"
                      aria-pressed="${index === 0}" aria-label="${face.name}: ${face.detail}">
                      <span class="face-glyph face-glyph-${face.id}" aria-hidden="true"></span><span>${face.name}</span>
                    </button>
                  `).join('')}
                </div>
              </fieldset>

              <fieldset class="creation-fieldset">
                <legend class="creation-label">Hairstyle</legend>
                <div class="hair-options" role="group" aria-label="Hairstyle">
                  ${appearanceOptions.hairstyles.map((style, index) => `
                    <button class="hair-option${index === 0 ? ' is-active' : ''}" type="button" data-hair="${style.id}"
                      aria-pressed="${index === 0}"><span class="hair-glyph hair-glyph-${style.id}" aria-hidden="true"></span>${style.name}</button>
                  `).join('')}
                </div>
              </fieldset>

              <fieldset class="creation-fieldset">
                <legend class="creation-label">Skin tone</legend>
                <div class="tone-options" role="group" aria-label="Skin tone">
                  ${appearanceOptions.skinTones.map((tone, index) => `
                    <button class="tone-option${tone.id === defaultAppearance.skinToneId ? ' is-active' : ''}" type="button"
                      data-tone="${tone.id}" aria-label="${tone.name}" aria-pressed="${tone.id === defaultAppearance.skinToneId}"
                      style="--tone-color: ${tone.color}"></button>
                  `).join('')}
                  <span class="tone-name">${appearanceOptions.skinTones.find(({ id }) => id === defaultAppearance.skinToneId).name}</span>
                </div>
              </fieldset>

              <fieldset class="creation-fieldset outfit-fieldset">
                <legend class="creation-label">Outfit</legend>
                <div class="outfit-options" role="group" aria-label="Outfit">
                  ${appearanceOptions.outfits.map((outfit, index) => `
                    <button class="outfit-option${outfit.id === defaultAppearance.outfitId ? ' is-active' : ''}" type="button"
                      data-outfit="${outfit.id}" aria-pressed="${outfit.id === defaultAppearance.outfitId}"
                      style="--outfit-swatch: ${outfit.color}; --outfit-trim: ${outfit.accent}">
                      <span class="outfit-swatch" aria-hidden="true"></span>${outfit.name}
                    </button>
                  `).join('')}
                </div>
              </fieldset>
            </div>
          </section>

          <section class="class-creation" aria-labelledby="class-title">
            <div class="class-heading">
              <div><p class="game-eyebrow"><span></span> The path you walk</p><h2 id="class-title">Choose your <em>calling.</em></h2></div>
              <p>Every class carries a different strength into the ruins.</p>
            </div>
            <div class="class-choice-grid">
              ${characters.map((character, index) => `
                <button class="class-choice${selectedClassId === character.id ? ' is-selected' : ''}" type="button"
                  data-class="${character.id}" aria-pressed="${selectedClassId === character.id}"
                  style="--class-accent: #${character.color.toString(16).padStart(6, '0')}">
                  <span class="class-choice-index">0${index + 1} / PATH</span>
                  <span class="class-choice-icon" aria-hidden="true">${character.id === 'warrior' ? '⚔' : character.id === 'mage' ? '✧' : '⬡'}</span>
                  <span class="class-choice-name">${character.name}</span>
                  <span class="class-choice-epithet">${character.epithet}</span>
                  <span class="class-choice-description">${character.description}</span>
                  <span class="class-ability"><b>${character.ability.name}</b>${character.ability.description}</span>
                  <span class="class-stats"><span>VITALITY <b>${character.health}</b></span><span>POWER <b>${character.attack}</b></span></span>
                  <span class="class-choice-check" aria-hidden="true">✓</span>
                </button>
              `).join('')}
            </div>
            <p class="class-error" role="status" aria-live="polite"></p>
          </section>

          <div class="creation-submit-row">
            <p>${lostKingdom.description}</p>
            <div class="creation-adventure-actions">
              <button class="game-primary-button" type="submit">
                Start adventure <span aria-hidden="true">↗</span>
              </button>
              <button class="game-secondary-button start-3d-adventure" type="button">
                Enter the 3D kingdom <span aria-hidden="true">✦</span>
              </button>
            </div>
          </div>
        </form>
      </section>
      <footer class="game-footnote">WASD / ARROW KEYS TO MOVE <span>·</span> E TO INTERACT <span>·</span> SPACE TO STRIKE</footer>
    </main>
  `

  const preview = root.querySelector('.hero-preview')
  const nameInput = root.querySelector('#hero-name')
  const nameError = root.querySelector('#hero-name-error')
  const classError = root.querySelector('.class-error')
  const form = root.querySelector('.creation-form')
  const classButtons = [...root.querySelectorAll('.class-choice')]

  function updatePreview() {
    const character = characters.find(({ id }) => id === selectedClassId)
    const skinTone = appearanceOptions.skinTones.find(({ id }) => id === hero.appearance.skinToneId)
    const outfit = appearanceOptions.outfits.find(({ id }) => id === hero.appearance.outfitId)
    preview.dataset.gender = hero.gender
    preview.dataset.face = hero.appearance.faceId
    preview.dataset.hair = hero.appearance.hairstyleId
    preview.style.setProperty('--skin-color', skinTone.color)
    preview.style.setProperty('--outfit-color', outfit.color)
    preview.style.setProperty('--outfit-accent', outfit.accent)
    preview.style.setProperty('--hero-accent', character ? `#${character.color.toString(16).padStart(6, '0')}` : '#c8a667')
    root.querySelector('.preview-class').textContent = character ? character.name.toUpperCase() : 'CHOOSE A CLASS'
    root.querySelector('.preview-name').textContent = hero.name.trim() || 'Your hero'
    root.querySelector('.preview-epithet').textContent = character ? character.ability.name.toUpperCase() : 'THE LOST KINGDOM AWAITS'
    root.querySelector('.tone-name').textContent = skinTone.name
  }

  root.querySelectorAll('.gender-option').forEach((button) => {
    button.addEventListener('click', () => {
      hero.gender = button.dataset.gender
      root.querySelectorAll('.gender-option').forEach((option) => {
        const selected = option === button
        option.classList.toggle('is-active', selected)
        option.setAttribute('aria-pressed', String(selected))
      })
      updatePreview()
    })
  })

  root.querySelectorAll('.face-option').forEach((button) => {
    button.addEventListener('click', () => {
      hero.appearance.faceId = button.dataset.face
      root.querySelectorAll('.face-option').forEach((option) => {
        const selected = option === button
        option.classList.toggle('is-active', selected)
        option.setAttribute('aria-pressed', String(selected))
      })
      updatePreview()
    })
  })

  root.querySelectorAll('.hair-option').forEach((button) => {
    button.addEventListener('click', () => {
      hero.appearance.hairstyleId = button.dataset.hair
      root.querySelectorAll('.hair-option').forEach((option) => {
        const selected = option === button
        option.classList.toggle('is-active', selected)
        option.setAttribute('aria-pressed', String(selected))
      })
      updatePreview()
    })
  })

  root.querySelectorAll('[data-tone]').forEach((button) => {
    button.addEventListener('click', () => {
      hero.appearance.skinToneId = button.dataset.tone
      root.querySelectorAll('.tone-option').forEach((option) => {
        const selected = option === button
        option.classList.toggle('is-active', selected)
        option.setAttribute('aria-pressed', String(selected))
      })
      updatePreview()
    })
  })

  root.querySelectorAll('[data-outfit]').forEach((button) => {
    button.addEventListener('click', () => {
      hero.appearance.outfitId = button.dataset.outfit
      root.querySelectorAll('.outfit-option').forEach((option) => {
        const selected = option === button
        option.classList.toggle('is-active', selected)
        option.setAttribute('aria-pressed', String(selected))
      })
      updatePreview()
    })
  })

  const classSelection = bindClassSelection(classButtons, selectedClassId, (classId) => {
    selectedClassId = classId
    classError.textContent = ''
    updatePreview()
  })

  nameInput.addEventListener('input', () => {
    hero.name = nameInput.value
    if (nameInput.value.trim()) {
      nameInput.removeAttribute('aria-invalid')
      nameError.textContent = ''
    }
    updatePreview()
  })

  function getHeroSelection() {
    hero.name = nameInput.value.trim()
    if (!hero.name) {
      nameInput.setAttribute('aria-invalid', 'true')
      nameError.textContent = 'Enter a hero name before beginning your adventure.'
      nameInput.focus()
      return null
    }
    const classId = classSelection.getSelectedClassId()
    if (!classId) {
      classError.textContent = 'Choose a class to begin The Lost Kingdom.'
      root.querySelector('.class-choice')?.focus()
      return null
    }
    return {
      name: hero.name,
      gender: hero.gender,
      classId,
      appearance: { ...hero.appearance },
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const selection = getHeroSelection()
    if (selection) onStart(selection)
  })

  root.querySelector('.start-3d-adventure').addEventListener('click', () => {
    const selection = getHeroSelection()
    if (!selection) return
    try {
      sessionStorage.setItem('mythic-arena-3d-hero', JSON.stringify(selection))
      window.location.hash = '#/3d-prototype?new=1'
    } catch (error) {
      classError.textContent = 'This browser could not preserve your hero selection. Check storage permissions and try again.'
      console.error('Unable to hand the custom hero to the 3D adventure.', error)
    }
  })

  updatePreview()
}
