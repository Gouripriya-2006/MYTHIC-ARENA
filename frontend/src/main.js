import './style.css'
import { getAudioManager } from './audio/audioManager.js'

const audio = getAudioManager()
audio.attachUI(document)

const icon = (name, className = '') => {
  const paths = {
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    sound: '<path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/><circle cx="12" cy="12" r="4"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z"/>',
  }
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`
}

const characters = [
  {
    name: 'Warrior',
    title: 'The last of the sunforged',
    number: '01',
    image: 'photo-1518709268805-4e9042af9f23',
    description: 'Stand unbroken. Let your courage shape the battle ahead.',
    accent: 'warrior',
  },
  {
    name: 'Mage',
    title: 'Keeper of the old stars',
    number: '02',
    image: 'photo-1519681393784-d120267933ba',
    description: 'Bend ancient forces and listen for what the cosmos hides.',
    accent: 'mage',
  },
  {
    name: 'Guardian',
    title: 'Oathbound to the wilds',
    number: '03',
    image: 'photo-1470770841072-f978cf4d019e',
    description: 'Protect the living world. Decide what deserves to endure.',
    accent: 'guardian',
  },
]

const features = [
  {
    number: '01',
    title: 'Voice, made mythic',
    name: 'Voice AI',
    icon: 'sound',
    description: 'Speak naturally. Your words become commands, conversations, and choices that carry weight.',
  },
  {
    number: '02',
    title: 'No two paths alike',
    name: 'Adaptive storytelling',
    icon: 'spark',
    description: 'A living narrative that responds to the way you think, the risks you take, and the alliances you earn.',
  },
  {
    number: '03',
    title: 'The world answers back',
    name: 'Intelligent enemies',
    icon: 'chevron',
    description: 'Opponents that read the moment and change their tactics. Every encounter demands a new instinct.',
  },
]

document.querySelector('#app').innerHTML = `
  <header class="site-header">
    <a class="brand" href="#home" aria-label="Mythic Arena home">
      <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
      <span class="brand-name">MYTHIC<span>·</span>ARENA</span>
    </a>
    <button class="menu-toggle" type="button" aria-label="Open navigation" aria-expanded="false">
      ${icon('menu')}
    </button>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="#world">The world</a>
      <a href="#characters">Choose your path</a>
      <a href="#technology">Our technology</a>
    </nav>
    <a class="header-cta" href="#characters">Enter the arena ${icon('arrow')}</a>
  </header>

  <main>
    <section class="hero" id="home" aria-labelledby="hero-title">
      <div class="hero-art" aria-hidden="true"></div>
      <div class="hero-grain" aria-hidden="true"></div>
      <div class="hero-content">
        <p class="eyebrow"><span class="eyebrow-line"></span> An AI-powered voice RPG <span class="eyebrow-line"></span></p>
        <h1 id="hero-title">MYTHIC<span class="title-divider">—</span><br><span class="title-second">ARENA</span></h1>
        <p class="hero-tagline">WHERE YOUR VOICE <span>CONTROLS DESTINY</span></p>
        <p class="hero-copy">When ancient legends collide with worlds yet unborn, your voice is the only weapon that can rewrite fate.</p>
        <a class="primary-button" href="#characters"><span>Start adventure</span>${icon('arrow')}</a>
        <div class="hero-footnote"><span class="status-dot"></span> A new legend is waiting to be told</div>
      </div>
      <a class="scroll-cue" href="#world"><span>Descend into the unknown</span><span class="scroll-line"></span></a>
      <div class="hero-coordinate" aria-hidden="true">BHARAT · 32° 43' N / A WORLD BETWEEN WORLDS</div>
    </section>

    <section class="world-section section-pad" id="world">
      <div class="world-image" role="img" aria-label="A vast mountain range beneath a cosmic night sky"></div>
      <div class="world-copy">
        <p class="eyebrow"><span class="eyebrow-line"></span> A universe without borders</p>
        <h2>Where myth<br>meets <em>the impossible.</em></h2>
        <p>Gods of the ancient world. Civilizations beyond the stars. A realm suspended between the two, waiting for someone brave enough to speak its next chapter.</p>
        <a class="text-link" href="#characters">Discover your calling ${icon('arrow')}</a>
      </div>
      <div class="world-caption"><span>01 — THE SHATTERED REALM</span><span>AN UNFINISHED STORY</span></div>
    </section>

    <section class="characters-section section-pad" id="characters">
      <div class="section-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-line"></span> Your legend starts here</p>
          <h2>Choose your <em>destiny.</em></h2>
        </div>
        <p class="section-aside">Three paths into the unknown.<br>Only one will answer your call.</p>
      </div>
      <div class="character-grid">
        ${characters.map((character) => `
          <article class="character-card ${character.accent}" style="--character-image: url('https://images.unsplash.com/${character.image}?auto=format&fit=crop&w=900&q=85')">
            <div class="character-art" role="img" aria-label="${character.name} path artwork"></div>
            <div class="character-shade"></div>
            <div class="character-number">${character.number} <span>— PATH</span></div>
            <div class="character-info">
              <p class="character-kicker">${character.title}</p>
              <h3>${character.name}</h3>
              <p class="character-description">${character.description}</p>
              <button class="character-select" type="button" data-character="${character.name}" aria-pressed="false">
                Choose ${character.name} ${icon('arrow')}
              </button>
            </div>
          </article>
        `).join('')}
      </div>
      <p class="selection-status" role="status" aria-live="polite"></p>
    </section>

    <section class="features-section section-pad">
      <div class="section-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-line"></span> A world that listens</p>
          <h2>Play beyond <em>the expected.</em></h2>
        </div>
        <p class="section-aside">Not just a story you play.<br>A story that plays with you.</p>
      </div>
      <div class="feature-list">
        ${features.map((feature) => `
          <article class="feature-item">
            <span class="feature-number">${feature.number}</span>
            <div class="feature-icon">${icon(feature.icon)}</div>
            <div class="feature-copy">
              <p>${feature.title}</p>
              <h3>${feature.name}</h3>
            </div>
            <p class="feature-description">${feature.description}</p>
            <span class="feature-arrow" aria-hidden="true">${icon('arrow')}</span>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="technology-section section-pad" id="technology">
      <div class="technology-glow" aria-hidden="true"></div>
      <div class="technology-content">
        <p class="eyebrow"><span class="eyebrow-line"></span> Powered by Gnani.ai</p>
        <h2>Human voice.<br><em>Mythic intelligence.</em></h2>
        <p class="technology-description">Built on expressive voice technology from Gnani.ai, so the worlds you explore can hear you, understand you, and answer in kind.</p>
        <div class="technology-stack" aria-label="Gnani AI technologies">
          <div class="technology-chip"><span>01</span><strong>Prisma</strong><small>Speech intelligence</small></div>
          <div class="technology-chip"><span>02</span><strong>Groq</strong><small>Game intent reasoning</small></div>
          <div class="technology-chip"><span>03</span><strong>Timbre</strong><small>Expressive voices</small></div>
        </div>
      </div>
      <div class="voice-orbit" aria-hidden="true">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div>
        <div class="orbit-core">${icon('sound')}</div>
        <span class="orbit-label orbit-label-top">SPEAK</span><span class="orbit-label orbit-label-bottom">BE HEARD</span>
      </div>
    </section>

    <section class="closing-section">
      <p class="eyebrow"><span class="eyebrow-line"></span> The realm is listening <span class="eyebrow-line"></span></p>
      <h2>What will you <em>become?</em></h2>
      <a class="primary-button" href="#characters"><span>Start adventure</span>${icon('arrow')}</a>
    </section>
  </main>

  <footer class="site-footer">
    <a class="brand" href="#home" aria-label="Mythic Arena home">
      <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
      <span class="brand-name">MYTHIC<span>·</span>ARENA</span>
    </a>
    <p>A universe waiting to be spoken into being.</p>
    <span class="copyright">© ${new Date().getFullYear()} MYTHIC ARENA</span>
  </footer>
`

const menuToggle = document.querySelector('.menu-toggle')
const navigation = document.querySelector('.main-nav')

menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true'
  menuToggle.setAttribute('aria-expanded', String(!isOpen))
  menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation')
  menuToggle.innerHTML = icon(isOpen ? 'menu' : 'close')
  navigation.classList.toggle('is-open', !isOpen)
})

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    navigation.classList.remove('is-open')
    menuToggle.setAttribute('aria-expanded', 'false')
    menuToggle.setAttribute('aria-label', 'Open navigation')
    menuToggle.innerHTML = icon('menu')
  }
})

const selectionStatus = document.querySelector('.selection-status')
document.querySelectorAll('.character-select').forEach((button) => {
  button.addEventListener('click', () => {
    const isSelected = button.getAttribute('aria-pressed') === 'true'
    document.querySelectorAll('.character-select').forEach((choice) => {
      choice.setAttribute('aria-pressed', 'false')
      choice.closest('.character-card').classList.remove('is-selected')
    })
    if (isSelected) {
      selectionStatus.textContent = 'Your path is open. Choose a hero to begin.'
      return
    }
    button.setAttribute('aria-pressed', 'true')
    button.closest('.character-card').classList.add('is-selected')
    const characterId = button.dataset.character.toLowerCase()
    selectionStatus.innerHTML = `${button.dataset.character} chosen. Your adventure awaits. <a class="launch-mission-link" href="#/play?character=${characterId}">Begin The Lost Kingdom <span aria-hidden="true">↗</span></a>`
  })
})

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible')
      revealObserver.unobserve(entry.target)
    }
  })
}, { threshold: 0.14 })

document.querySelectorAll('.world-copy, .section-heading, .character-card, .feature-item, .technology-content, .voice-orbit, .closing-section').forEach((element) => {
  element.classList.add('reveal')
  revealObserver.observe(element)
})

let gameAppCleanup = null
let gameRouteRequest = 0

function isGameRoute() {
  return window.location.hash === '#/play' || window.location.hash.startsWith('#/play?')
}

async function syncGameRoute() {
  const request = ++gameRouteRequest
  const isPrototypeRoute = window.location.hash === '#/3d-prototype' || window.location.hash.startsWith('#/3d-prototype?')
  const isPlaying = isPrototypeRoute || isGameRoute()
  if (isPlaying) audio.playMusic('realm')
  else audio.stopMusic()
  if (isPrototypeRoute) {
    gameAppCleanup?.()
    gameAppCleanup = null
    if (prototypeAppCleanup) return
    const { mountPrototypeApp } = await import('./prototype3d/prototypeApp.js')
    if (request !== gameRouteRequest || !window.location.hash.startsWith('#/3d-prototype')) return
    prototypeAppCleanup = mountPrototypeApp()
    return
  }

  prototypeAppCleanup?.()
  prototypeAppCleanup = null

  if (!isGameRoute()) {
    gameAppCleanup?.()
    gameAppCleanup = null
    document.body.classList.remove('game-mode')
    return
  }

  if (gameAppCleanup) return
  const { mountGameApp } = await import('./game/gameApp.js')
  if (request !== gameRouteRequest || !isGameRoute()) return
  gameAppCleanup = mountGameApp()
}

let prototypeAppCleanup = null
window.addEventListener('hashchange', syncGameRoute)
syncGameRoute()
