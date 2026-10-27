import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import { buildScene, encodeCells, STAGES } from './orca'

const TICK_MS = 80
const RASTER_KEY = 'sea'
const STAGE_COLORS = ['#9be7ff', '#5fd7ff', '#2fb8ff', '#ffd75f', '#ff8f5f']

const tools = atom({ plugin: 'orka', key: 'tools' } as const, 0)

type Site = { requestId: string; columns: number; maxRows: number; rows: number; steps: number }

let timer: Timer | undefined
let frame = 0
let site: Site | undefined

// Each tick repaints the mounted Raster in place; only a size change asks
// for a full redraw of the band.
async function paint($: EngineInterface) {
  frame += 1
  if (site === undefined) return
  const scene = buildScene(site.steps, frame, site.columns, site.maxRows)
  if (scene.rows !== site.rows) return $.ui.invalidate('ui.render')
  const painted = await $.ui.blit({
    requestId: site.requestId,
    key: RASTER_KEY,
    cells: encodeCells(scene.cells),
    columns: scene.columns,
    rows: scene.rows,
  })
  if (painted.deny !== undefined) $.ui.invalidate('ui.render')
}

function startSwimming($: EngineInterface) {
  timer ??= $.clock.every(TICK_MS, () => void paint($))
}

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    frame = 0
    await update($, tools, () => 0)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', ($, e, next) => {
    startSwimming($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    startSwimming($)
    await update($, tools, n => n + 1)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      timer?.cancel()
      timer = undefined
      site = undefined
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!e.props.isWorking || e.props.hasSurvey || e.surface !== 'terminal') {
      site = undefined
      return next(e)
    }

    const steps = await read($, tools)
    const maxRows = e.props.maxRows - 1
    const scene = buildScene(steps, frame, e.props.bodyColumns, maxRows)
    site = { requestId: e.requestId, columns: scene.columns, maxRows, rows: scene.rows, steps }
    const following = STAGES[scene.stageNumber]
    const color = STAGE_COLORS[scene.stageNumber - 1]
    const { Box, Raster, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Raster key={RASTER_KEY} columns={scene.columns} rows={scene.rows} cells={encodeCells(scene.cells)} />
        <Box key="caption" flexDirection="row">
          <Text bold color="#5fd7ff">Orca </Text>
          <Text bold color={color}>{scene.stage.name} </Text>
          <Text color={color}>{'●'.repeat(scene.stageNumber)}</Text>
          <Text color="#3a4a5a">{'○'.repeat(STAGES.length - scene.stageNumber)}</Text>
          <Text color="#9aa4ab">{` · ${steps} ${steps === 1 ? 'step' : 'steps'}`}</Text>
          {following ? (
            <Text dimColor wrap="truncate">{` · next: ${following.name} (${following.minTools - steps} to go)`}</Text>
          ) : (
            <Text color="#ffd75f" wrap="truncate"> · fully grown</Text>
          )}
        </Box>
      </Box>
    )
  })
}
