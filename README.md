# ⚔️ MYTHIC-ARENA
### Where Your Voice Controls Destiny

**An AI-Powered Voice-First RPG Combining Indian Mythology, Fantasy, and Sci-Fi**

MYTHIC-ARENA is an immersive role-playing game that combines 2D and 3D gameplay with AI-powered voice interaction. Players can explore a mythical world, interact with characters, fight enemies, complete quests, and control gameplay using natural voice commands.

The project integrates **Gnani AI Prisma (Speech-to-Text), Gnani AI Timbre (Text-to-Speech), and Groq (AI Reasoning)** to create an interactive voice-controlled gaming experience.

---

## 🌟 Project Overview

MYTHIC-ARENA introduces a voice-first gaming experience where players can interact with the game using natural spoken commands instead of relying entirely on traditional keyboard controls.

Set in a fictional world inspired by Indian mythology, fantasy, and science fiction, the game follows an adventure through **The Lost Kingdom**.

Players can choose their character class, explore the environment, interact with NPCs, battle enemies, develop their abilities, and face powerful bosses.

---

## ✨ Key Features

### 🎮 Dual Gameplay Experience
- Interactive 2D RPG gameplay using Phaser.
- Immersive 3D adventure prototype using Babylon.js.
- Character selection with Warrior, Mage, and Guardian classes.
- Exploration of a fantasy-inspired game environment.

### 🎙️ AI-Powered Voice Interaction
- Speech recognition using Gnani AI Prisma STT.
- Natural language reasoning using Groq.
- Voice response generation using Gnani AI Timbre TTS.
- Voice-controlled character interactions and combat.
- Validated voice commands before execution.

### ⚔️ RPG Gameplay Mechanics
- Real-time combat system.
- Multiple enemy types and AI behaviours.
- Multi-phase Ravana boss battle.
- Inventory and equipment systems.
- Skill tree and character progression.
- NPC interactions and merchant system.
- Quest and mission progression.
- In-game audio and sound effects.

### 🏆 Mission: The Lost Kingdom
Players embark on an adventure to restore the lost kingdom by completing missions, defeating enemies, and confronting the final boss.

---

## 🤖 AI Integration

MYTHIC-ARENA uses a voice-processing pipeline:

**Microphone → Gnani Prisma STT → Groq AI Reasoning → Intent Validation → Game Action Dispatcher → Game Execution → Gnani Timbre TTS**

| Technology | Purpose |
|---|---|
| Gnani AI Prisma | Speech-to-Text |
| Groq | Natural language reasoning and intent interpretation |
| Gnani AI Timbre | Text-to-Speech |
| JavaScript | Voice integration and game logic |

The AI interprets player commands, while validated game actions are executed through the game's deterministic action system.

---

## 🛠️ Technologies Used

| Category | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| 2D Game Engine | Phaser |
| 3D Engine | Babylon.js |
| Backend | Node.js |
| AI Integration | Gnani AI, Groq |
| Speech Recognition | Prisma STT |
| Speech Generation | Timbre TTS |
| Testing | Vitest, Playwright |
| Version Control | Git, GitHub |

---

## 🏗️ Project Structure

```text
MYTHIC-ARENA/
│
├── backend/
│   ├── src/
│   ├── test/
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   │   └── assets/
│   ├── src/
│   │   ├── audio/
│   │   ├── game/
│   │   └── prototype3d/
│   ├── e2e/
│   ├── package.json
│   └── index.html
│
├── shared/
│   └── voiceIntent.js
│
├── docs/
│
└── .gitignore
```

---

## 🚀 Installation and Setup

### Prerequisites

- Node.js
- npm
- Git
- Gnani AI API credentials
- Groq API key

### 1. Clone the Repository

```bash
git clone https://github.com/Gouripriya-2006/MYTHIC-ARENA.git
```

```bash
cd MYTHIC-ARENA
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create your environment configuration file:

```bash
cp .env.example .env
```

Add the required Gnani AI and Groq API credentials to the `.env` file using the variable names specified in `.env.example`.

Start the backend:

```bash
node --env-file=.env server.js
```

Backend URL:

```text
http://127.0.0.1:3001
```

### 3. Frontend Setup

Open another terminal:

```bash
cd MYTHIC-ARENA/frontend
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local development URL displayed in the terminal, usually:

```text
http://localhost:5173
```

---

## 🎮 Gameplay Controls

| Key | Action |
|---|---|
| W / A / S / D | Character movement |
| Arrow Keys | Character movement |
| Shift | Sprint |
| Space | Jump |
| E | Interact |
| J | Light attack |
| K | Heavy attack |
| Q | Class ability |
| B | Guard |
| Ctrl | Dodge |
| I | Inventory |
| L | Quest Journal |
| M | Map |
| U | Skill Tree |
| Esc | Pause / Close panel |
| Mouse Drag | Rotate camera |
| Mouse Wheel | Zoom |

Voice commands are also supported for selected gameplay actions.

---

## 🧪 Testing

The project includes automated unit tests and browser-based end-to-end tests.

Testing tools:
- Vitest
- Playwright

These tests help validate game mechanics, character progression, combat systems, voice command processing, and gameplay interactions.

---

## 🎥 Demo Video

**Project Demonstration:**  
[Add your demo video link here]

---

## 📸 Screenshots

Screenshots of the 2D gameplay, 3D environment, character selection, voice interaction panel, and boss battle can be added here.

---

## 🔮 Future Enhancements

- More advanced character animations.
- Additional mythical worlds and missions.
- More interactive NPCs and enemies.
- Expanded voice command capabilities.
- Enhanced multiplayer gameplay.
- Improved environmental effects and graphics.

---

## 👩‍💻 Developer

**Developed by:** Gouripriya

**Project:** MYTHIC-ARENA

**Challenge:** Gnani AI – Great Indian AI Internship Challenge 2026

**GitHub Repository:**  
https://github.com/Gouripriya-2006/MYTHIC-ARENA

---

## 🙏 Acknowledgements

Special thanks to Gnani AI for providing AI speech technologies and the opportunity to develop an innovative AI-powered gaming experience.

Thanks to the open-source developer community for the tools and technologies that made this project possible.

---

<p align="center">
  <b>MYTHIC-ARENA</b><br>
  Where Your Voice Controls Destiny ⚔️
</p>
