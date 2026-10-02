import { describe, it, expect } from 'vitest'
import { summarizeReport } from '../src/admin/report.js'

describe('private dashboard measures', () => {
  it('keeps diagnostics distinct and separates JavaScript errors from disconnections', () => {
    const report = { reports: [{ day: '2026-10-03', feedback: [], counters: [
      { event: 'client_error', method: 'script_error', count: 7 },
      { event: 'client_error', method: 'script_error', errorName: 'TypeError', script: 'app', line: 42, column: 123, version: 'new', count: 2 },
      { event: 'client_error', method: 'unhandled_rejection', count: 5 },
      { event: 'client_error', method: 'socket_disconnected', count: 26 },
      { event: 'join_rejected', method: 'game_in_progress', count: 24 },
    ] }] }
    const summary = summarizeReport(report)
    expect(summary.errors).toHaveLength(5)
    expect(summary.javascriptErrors).toBe(14)
    expect(summary.disconnections).toBe(26)
    expect(summary.clientErrors).toBe(40)
    expect(summary.serverErrors).toBe(24)
  })
  it('separates page paths from landings, omits labeled tests and never derives failed games', () => {
    const report = { reports: [{ day: '2026-09-24', counters: [
      { event: 'visit', landing: '/guide/', count: 3 },
      { event: 'page_view', path: '/', landing: '/guide/', count: 5 },
      { event: 'page_view', path: '/guide/', landing: '/', count: 2 },
      { event: 'game_started', count: 7 }, { event: 'game_finished', count: 5 },
      { event: 'game_finished', source: 'verification', count: 1 },
      { event: 'game_interrupted', count: 1 },
      { event: 'join_failed', method: 'rejected', count: 2 },
      { event: 'join_rejected', method: 'room_full', count: 2 },
    ], feedback: [{ id: '1', receivedAt: '2026-09-24T10:00:00Z', comment: 'Mi opinión' }] }] }
    const result = summarizeReport(report)
    expect(result.totals.game_finished).toBe(5)
    expect(result.totals.game_interrupted).toBe(1)
    expect(result.totals).not.toHaveProperty('game_failed')
    expect(result.pages).toEqual([{ path: '/', count: 5 }, { path: '/guide/', count: 2 }])
    expect(result.landings).toEqual([{ path: '/guide/', count: 3 }])
    expect(result.clientErrors).toBe(2)
    expect(result.serverErrors).toBe(2)
    expect(summarizeReport(report, false).totals.game_finished).toBe(6)
    expect(result.feedback).toHaveLength(1)
  })
  it('preserves empty days and sorts the history without mutating the report', () => {
    const report = { reports: ['2026-09-24', '2026-09-23'].map(day => ({ day, counters: [], feedback: [] })) }
    expect(summarizeReport(report).daily.map(row => row.day)).toEqual(['2026-09-23', '2026-09-24'])
    expect(report.reports[0].day).toBe('2026-09-24')
  })
})
