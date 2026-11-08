import assert from 'node:assert/strict'
import test from 'node:test'
import { bindClassSelection } from './classSelection.js'

class TestClassList {
  constructor() {
    this.values = new Set()
  }

  toggle(name, force) {
    if (force) this.values.add(name)
    else this.values.delete(name)
  }

  contains(name) {
    return this.values.has(name)
  }
}

class TestButton extends EventTarget {
  constructor(classId) {
    super()
    this.dataset = { class: classId }
    this.classList = new TestClassList()
    this.attributes = new Map()
  }

  setAttribute(name, value) {
    this.attributes.set(name, value)
  }

  getAttribute(name) {
    return this.attributes.get(name)
  }
}

test('clicking each class selects it, highlights only it, and publishes the selected class', () => {
  const buttons = ['warrior', 'mage', 'guardian'].map((id) => new TestButton(id))
  const changes = []
  const selection = bindClassSelection(buttons, null, (classId) => changes.push(classId))

  for (const classId of ['warrior', 'mage', 'guardian']) {
    const clickedButton = buttons.find((button) => button.dataset.class === classId)
    clickedButton.dispatchEvent(new Event('click'))

    assert.equal(selection.getSelectedClassId(), classId)
    assert.deepEqual(
      buttons.filter((button) => button.classList.contains('is-selected')).map((button) => button.dataset.class),
      [classId],
    )
    assert.deepEqual(
      buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').map((button) => button.dataset.class),
      [classId],
    )
  }

  assert.deepEqual(changes, ['warrior', 'mage', 'guardian'])
})

test('ignores unknown classes and supports an initial selection', () => {
  const buttons = ['warrior', 'mage', 'guardian'].map((id) => new TestButton(id))
  const unknownButton = new TestButton('unknown')
  buttons.push(unknownButton)
  const changes = []
  const selection = bindClassSelection(buttons, 'mage', (classId) => changes.push(classId))

  buttons[1].dispatchEvent(new Event('click'))
  assert.equal(selection.getSelectedClassId(), 'mage')
  assert.deepEqual(changes, ['mage'])

  unknownButton.dispatchEvent(new Event('click'))
  assert.equal(selection.getSelectedClassId(), 'mage')
  assert.deepEqual(changes, ['mage'])
  selection.destroy()
})
