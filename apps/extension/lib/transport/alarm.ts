/**
 * Transport Reconnect Alarm (FR-402, TRD §6.1, §6.11).
 * Manages periodic chrome.alarms wake triggers when the transport is in backoff state.
 */

export const RECONNECT_ALARM_NAME = 'tether-reconnect';
export const RECONNECT_ALARM_PERIOD_MINUTES = 0.5;

/**
 * Creates or refreshes the tether-reconnect alarm with a 0.5 minute period.
 */
export function ensureReconnectAlarm(): void {
  if (typeof chrome !== 'undefined' && chrome.alarms?.create) {
    try {
      chrome.alarms.create(RECONNECT_ALARM_NAME, {
        periodInMinutes: RECONNECT_ALARM_PERIOD_MINUTES,
      });
    } catch {
      // Alarms API unavailable or errored
    }
  }
}

/**
 * Clears the tether-reconnect alarm.
 */
export function clearReconnectAlarm(): void {
  if (typeof chrome !== 'undefined' && chrome.alarms?.clear) {
    try {
      chrome.alarms.clear(RECONNECT_ALARM_NAME);
    } catch {
      // Alarms API unavailable or errored
    }
  }
}
