import { characters } from '../data/characters.js'

export function bindClassSelection(buttons, initialClassId, onChange) {
  let selectedClassId = characters.some(({ id }) => id === initialClassId) ? initialClassId : null
  const handlers = new Map()

  function applySelection(classId) {
    if (!characters.some((character) => character.id === classId)) return

    selectedClassId = classId
    buttons.forEach((button) => {
      const selected = button.dataset.class === selectedClassId
      button.classList.toggle('is-selected', selected)
      button.setAttribute('aria-pressed', String(selected))
    })
    onChange(selectedClassId)
  }

  buttons.forEach((button) => {
    const handler = () => applySelection(button.dataset.class)
    handlers.set(button, handler)
    button.addEventListener('click', handler)
  })

  return {
    getSelectedClassId: () => selectedClassId,
    destroy() {
      handlers.forEach((handler, button) => button.removeEventListener('click', handler))
    },
  }
}
