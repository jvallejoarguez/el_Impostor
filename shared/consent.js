export const CONSENT_VERSION = 1
export const CONSENT_MAX_AGE = 180 * 86400000

export function validMeasurementConsent(value, now = Date.now()) {
  return value?.version === CONSENT_VERSION && value.decision === 'accepted' &&
    Number.isFinite(value.at) && value.at <= now && value.at > now - CONSENT_MAX_AGE
}

export function consentReceipt(value, now = Date.now()) {
  return validMeasurementConsent(value, now) ? { version: CONSENT_VERSION, decision: 'accepted', at: value.at } : null
}
