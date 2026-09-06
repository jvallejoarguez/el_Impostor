// The only fields accepted by the collector. Never pass game state, names or roles.
export const CLIENT_EVENTS = new Set([
  'visit', 'create_intent', 'create_failed', 'join_attempt', 'join_failed',
  'invite_link_opened', 'share_invite', 'copy_room_code', 'qr_opened',
  'demo_guess', 'play_again_requested', 'new_group_intent', 'lobby_left',
  'download_result_card', 'feedback_opened', 'rating_prompt_shown',
])
export const SERVER_EVENTS = new Set([
  'room_created', 'player_joined', 'group_ready', 'room_activated', 'game_started', 'game_finished', 'game_repeated',
])
export const FEEDBACK_KINDS = ['rating', 'problem', 'idea', 'words', 'exit']
export const FEEDBACK_TOPICS = ['connection', 'rules', 'words', 'pace', 'missing_players', 'just_looking', 'other']
export const PHASES = ['home', 'create', 'join', 'connecting', 'lobby', 'countdown', 'roleReveal', 'playing', 'roundReview', 'betweenRound', 'voting', 'results']
const label = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : ''
const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value) ? value : ''

export function cleanAttribution(input = {}) {
  input = input && typeof input === 'object' ? input : {}
  return {
    source: label(input.source) || 'direct',
    medium: label(input.medium) || 'none',
    campaign: label(input.campaign),
    content: label(input.content),
    landing: typeof input.landing === 'string' && /^\/[a-z0-9/-]{0,100}$/.test(input.landing) ? input.landing : '/',
  }
}

export function cleanContext(input = {}) {
  input = input && typeof input === 'object' ? input : {}
  const result = {}
  if (PHASES.includes(input.phase)) result.phase = input.phase
  if (Number.isInteger(input.playerCount) && input.playerCount >= 0 && input.playerCount <= 12) result.playerCount = input.playerCount
  for (const key of ['method', 'version']) if (label(input[key])) result[key] = input[key]
  if (typeof input.category === 'string' && /^[a-z0-9_-]{1,512}$/.test(input.category)) result.category = input.category
  if (uuid(input.gameId)) result.gameId = input.gameId
  if (typeof input.wasInvited === 'boolean') result.wasInvited = input.wasInvited
  if (typeof input.correct === 'boolean') result.correct = input.correct
  if (typeof input.path === 'string' && /^\/[a-z0-9/-]{0,100}$/.test(input.path)) result.path = input.path
  return result
}

export function cleanEvent(input, trusted = false) {
  if (!input || !uuid(input.id) || !(trusted ? SERVER_EVENTS : CLIENT_EVENTS).has(input.event)) return null
  return { id: input.id, event: input.event, attribution: cleanAttribution(input.attribution), context: cleanContext(input.context) }
}

export function cleanFeedback(input) {
  if (!input || !uuid(input.id) || !FEEDBACK_KINDS.includes(input.kind)) return null
  const rating = ['good', 'okay', 'bad'].includes(input.rating) ? input.rating : null
  const topic = FEEDBACK_TOPICS.includes(input.topic) ? input.topic : null
  const comment = typeof input.comment === 'string' ? input.comment.trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1000) : ''
  if (input.kind === 'rating' && !rating) return null
  if (!rating && !topic && !comment) return null
  return { id: input.id, kind: input.kind, rating, topic, comment, context: cleanContext(input.context) }
}
