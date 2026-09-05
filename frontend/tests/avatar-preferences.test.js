import { describe, expect, it } from 'vitest'
import { readAvatarPreference } from '../src/avatarPreferences.js'
import { AVATAR_NAMES, avatarIndex } from '../../shared/avatars.js'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ClueHistory } from '../src/components/clue-history.jsx'

describe('avatar preferences', () => {
  it('uses the selected portrait in the clue history as well as the lobby', () => {
    const html = renderToStaticMarkup(React.createElement(ClueHistory, {avatarStyle:'club', room:{players:[{id:'ana', name:'Ana', avatarId:0}], wordHistory:[]}}))
    expect(html).toContain('data-avatar="zorro"')
    expect(html).not.toContain('data-avatar="paloma"')
  })
  it('restores a selected portrait including the first and last choices', () => {
    for (const id of [0, AVATAR_NAMES.length - 1]) {
      expect(readAvatarPreference({getItem:() => JSON.stringify(id)})).toBe(id)
      expect(avatarIndex('Ana', id)).toBe(id)
    }
  })
  it('falls back to a stable portrait if stored preferences are missing or invalid', () => {
    for (const raw of [null, '{', 'true', '"1"', '-1', '12', '1.2', '{}']) {
      expect(readAvatarPreference({getItem:() => raw})).toBeNull()
    }
    expect(readAvatarPreference({getItem:() => {throw new Error('blocked')}})).toBeNull()
    expect(avatarIndex('José', null)).toBe(avatarIndex('Jose\u0301', undefined))
    expect(avatarIndex('Ana', -1)).toBe(avatarIndex('Ana', null))
  })
})
