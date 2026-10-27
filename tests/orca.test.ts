import type { RenderElement } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { buildScene, encodeCells, stageIndexFor, STAGES } from '../hooks/orca'

describe('orka', () => {
  test('grows stage by stage as tool calls add up', async () => {
    expect(stageIndexFor(0)).toBe(0)
    expect(stageIndexFor(2)).toBe(1)
    expect(stageIndexFor(5)).toBe(2)
    expect(stageIndexFor(10)).toBe(3)
    expect(stageIndexFor(17)).toBe(4)
    expect(stageIndexFor(500)).toBe(STAGES.length - 1)
    const sizes = [0, 2, 5, 10, 17].map(t => buildScene(t, 40, 120, 40).orcaPixels)
    sizes.slice(1).forEach((size, i) => expect(size).toBeGreaterThan(sizes[i]!))
  })

  test('fits the band and keeps the grown stage name', async () => {
    const small = buildScene(20, 0, 80, 8)
    expect(small.rows).toBeLessThanOrEqual(8)
    expect(small.stage.name).toBe('Legend')
    expect(small.cells.length).toBe(80 * small.rows * 3)
  })

  test('moves between frames', async () => {
    expect(encodeCells(buildScene(5, 10, 60, 20).cells)).not.toBe(encodeCells(buildScene(5, 11, 60, 20).cells))
  })

  test('encodes cells as padded base64', async () => {
    expect(encodeCells(Uint32Array.of(0x2588, 0xff8800, 0x01000000))).toBe('iCUAAACI/wAAAAAB')
  })
})

test('band draws the orca only while working', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, { key: 'engine' }, 'engine') as RenderElement
  })
  const props = { hasSurvey: false, bodyColumns: 60, maxRows: 20, scroll: { offset: 0, bodyRows: 20 }, view: {} }
  const working = await $.ui.mount({ plugin: 'orka', surface: 'terminal', component: 'AbovePrompt', props: { ...props, isWorking: true } })
  expect(await working.find({ type: 'Raster' })).toBeDefined()
  expect(await working.find({ type: 'Text', text: /Calf/ })).toBeDefined()
  await working.unmount()
  const idle = await $.ui.mount({ plugin: 'orka', surface: 'terminal', component: 'AbovePrompt', props: { ...props, isWorking: false } })
  expect(await idle.find({ type: 'Raster' })).toBeUndefined()
  await idle.unmount()
})
