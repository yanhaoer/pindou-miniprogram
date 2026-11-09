import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  serializeGridForDraft,
  deserializeGridFromDraft,
  normalizeGridCells,
  EMPTY_BEAD_COLOR
} from '../../src/utils/draft-helpers'
import { callCloudFunction } from '../../src/utils/cloud'
import { getBeadColorStats } from '../../src/utils/quantizer'

describe('Draft Serialization Helpers', () => {
  it('should serialize 2D bead grid into compact color objects', () => {
    const grid: any = [
      [{ color: { code: 'A01', hex: '#FF0000', name: '红' } }, null],
      [null, { color: { code: 'A02', hex: '#00FF00', name: '绿' } }]
    ]
    const serialized = serializeGridForDraft(grid)
    expect(serialized).toEqual([
      [{ code: 'A01', hex: '#FF0000' }, null],
      [null, { code: 'A02', hex: '#00FF00' }]
    ])
  })

  it('should serialize empty cells (isEmpty: true) into null', () => {
    const grid: any = [
      [
        { color: { code: 'A01', hex: '#FF0000' }, isEmpty: false },
        { color: { code: 'A02', hex: '#00FF00' }, isEmpty: true }
      ]
    ]
    const serialized = serializeGridForDraft(grid)
    expect(serialized).toEqual([
      [{ code: 'A01', hex: '#FF0000' }, null]
    ])
  })

  it('should deserialize compact draft grid into BeadCell objects', () => {
    const serialized = [
      [{ code: 'A01', hex: '#FF0000' }, null]
    ]
    const restored = deserializeGridFromDraft(serialized, 'artkal')
    expect(restored[0][0]?.color.code).toBe('A01')
    expect(restored[0][0]?.coord).toEqual({ x: 0, y: 0 })
    expect(restored[0][1]).toBeNull()
  })

  it('should handle non-array or invalid gridData gracefully', () => {
    expect(deserializeGridFromDraft(null as any, 'artkal')).toEqual([])
    expect(deserializeGridFromDraft(undefined as any, 'artkal')).toEqual([])
    expect(deserializeGridFromDraft('invalid' as any, 'artkal')).toEqual([])
    expect(deserializeGridFromDraft([null as any], 'artkal')).toEqual([[]])
  })

  it('should handle unknown color codes with fallback', () => {
    const serialized = [
      [{ code: 'UNKNOWN_999', hex: '#123456' }]
    ]
    const restored = deserializeGridFromDraft(serialized, 'artkal')
    expect(restored[0][0]?.color.code).toBe('UNKNOWN_999')
    expect(restored[0][0]?.color.hex).toBe('#123456')
    expect(restored[0][0]?.color.rgb).toEqual([0, 0, 0])
    expect(restored[0][0]?.coord).toEqual({ x: 0, y: 0 })
  })

  it('should accurately round-trip grid through serialization and deserialization', () => {
    const originalGrid: any = [
      [
        { x: 0, y: 0, color: { code: 'S01', hex: '#000000', rgb: [0, 0, 0] }, isEmpty: false },
        null
      ],
      [
        { x: 0, y: 1, color: { code: 'S02', hex: '#FFFFFF', rgb: [255, 255, 255] }, isEmpty: false },
        { x: 1, y: 1, color: { code: 'S03', hex: '#FF0000', rgb: [255, 0, 0] }, isEmpty: true }
      ]
    ]

    const serialized = serializeGridForDraft(originalGrid)
    expect(serialized).toEqual([
      [{ code: 'S01', hex: '#000000' }, null],
      [{ code: 'S02', hex: '#FFFFFF' }, null]
    ])

    const restored = deserializeGridFromDraft(serialized, 'artkal')
    expect(restored.length).toBe(2)
    expect(restored[0][0]?.color.code).toBe('S01')
    expect(restored[0][1]).toBeNull()
    expect(restored[1][0]?.color.code).toBe('S02')
    expect(restored[1][1]).toBeNull()

    const stats = getBeadColorStats(restored)
    expect(stats.get('S01')?.count).toBe(1)
    expect(stats.get('S02')?.count).toBe(1)
    expect(stats.size).toBe(2)
  })

  it('from deserialized draft -> modify cell -> run stats & re-serialize without crashes', () => {
    const rawDraftGrid = [
      [{ code: 'A01', hex: '#FF0000' }, null],
      [null, { code: 'A02', hex: '#00FF00' }]
    ]
    // 1. Restore with normalizeEmpty
    const restored = normalizeGridCells(
      deserializeGridFromDraft(rawDraftGrid, 'artkal', { normalizeEmpty: true })
    )

    // 2. Safe shallow copying (prevents { ...null } becoming empty {})
    const copied = restored.map(row =>
      row.map(c => (c ? { ...c, color: c.color ? { ...c.color } : undefined } : null as any))
    )

    // 3. Edit cell: set color on previously empty cell
    copied[0][1].color = { code: 'A03', hex: '#0000FF', name: '蓝', rgb: [0, 0, 255] }
    copied[0][1].isEmpty = false

    // 4. Edit cell: erase an active cell
    copied[0][0].isEmpty = true
    copied[0][0].color = EMPTY_BEAD_COLOR

    // 5. Run stats without crashing on missing color or code
    const stats = getBeadColorStats(copied)
    expect(stats.get('A01')).toBeUndefined()
    expect(stats.get('A03')?.count).toBe(1)
    expect(stats.get('A02')?.count).toBe(1)
    expect(stats.get('__EMPTY__')).toBeUndefined()

    // 6. Re-serialize for draft saving
    const reSerialized = serializeGridForDraft(copied)
    expect(reSerialized).toEqual([
      [null, { code: 'A03', hex: '#0000FF' }],
      [null, { code: 'A02', hex: '#FFFFFF' }]
    ])
  })

  it('from raw deserialized draft with nulls -> safe copy & edit -> no crash', () => {
    const rawDraftGrid = [
      [{ code: 'A01', hex: '#FF0000' }, null]
    ]
    const restored = deserializeGridFromDraft(rawDraftGrid, 'artkal') // has null cell
    expect(restored[0][1]).toBeNull()

    // Safe shallow copying avoids { ...null } becoming {}
    const copied = restored.map(row =>
      row.map(c => (c ? { ...c, color: c.color ? { ...c.color } : undefined } : null as any))
    )
    expect(copied[0][1]).toBeNull()

    // Run stats
    const stats = getBeadColorStats(copied)
    expect(stats.get('A01')?.count).toBe(1)

    // Re-serialize
    const reSerialized = serializeGridForDraft(copied)
    expect(reSerialized).toEqual([
      [{ code: 'A01', hex: '#1A1A1A' }, null]
    ])
  })
})

describe('Cloud Draft Integration End-to-End Simulation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).Taro
  })

  it('should simulate saveDraft payload construction and cloud dispatch', async () => {
    const mockCallFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        message: 'success',
        data: { id: 'pattern_12345', updated_at: '2026-11-05T06:00:00Z' }
      }
    })

    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: mockCallFunction
      },
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
      showToast: vi.fn()
    }
    ;(globalThis as any).Taro = mockTaro

    const grid: any = [
      [{ color: { code: 'A01', hex: '#FF0000' } }, null]
    ]
    const colorStats = new Map([['A01', { color: { code: 'A01', hex: '#FF0000' }, count: 1 }]])
    const colorSummary: Record<string, number> = {}
    colorStats.forEach((v, k) => {
      if (k !== '__EMPTY__') {
        colorSummary[k] = v.count
      }
    })

    const payload = {
      title: '我的小狐狸',
      width: 29,
      height: 29,
      brand: 'artkal',
      grid_data: serializeGridForDraft(grid),
      color_summary: colorSummary,
      preview_url: ''
    }

    const res = await callCloudFunction<{ id: string }>('pattern.saveDraft', payload)
    expect(res.id).toBe('pattern_12345')
    expect(mockCallFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'pattern.saveDraft',
        data: payload
      }
    })
  })

  it('should simulate getDetail response restoration into grid and parameters', async () => {
    const mockDetail = {
      _id: 'draft_999',
      title: '皮卡丘拼豆',
      width: 16,
      height: 16,
      brand: 'perler',
      grid_data: [
        [{ code: 'P01', hex: '#FFFF00' }, null],
        [null, { code: 'P02', hex: '#000000' }]
      ],
      color_summary: { P01: 1, P02: 1 }
    }

    const mockCallFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        message: 'success',
        data: mockDetail
      }
    })

    const mockTaro = {
      cloud: {
        init: vi.fn(),
        callFunction: mockCallFunction
      }
    }
    ;(globalThis as any).Taro = mockTaro

    const detail = await callCloudFunction<typeof mockDetail>('pattern.getDetail', { id: 'draft_999' })
    expect(detail._id).toBe('draft_999')
    expect(detail.width).toBe(16)
    expect(detail.brand).toBe('perler')

    const rawGrid = deserializeGridFromDraft(detail.grid_data, detail.brand as any, { normalizeEmpty: true })
    const restoredGrid = normalizeGridCells(rawGrid)
    expect(restoredGrid.length).toBe(2)
    expect(restoredGrid[0][0]?.color.code).toBe('P01')
    expect(restoredGrid[0][1]?.isEmpty).toBe(true)
    expect(restoredGrid[1][0]?.isEmpty).toBe(true)
    expect(restoredGrid[1][1]?.color.code).toBe('P02')

    const stats = getBeadColorStats(restoredGrid)
    expect(stats.get('P01')?.count).toBe(1)
    expect(stats.get('P02')?.count).toBe(1)
    expect(stats.get('__EMPTY__')).toBeUndefined()
  })
})
