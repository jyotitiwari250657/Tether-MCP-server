/**
 * Transport Module Exports (PRD FR-401..FR-405, TRD §6.11).
 */

export { TransportClient, type TransportConfig, type TransportState } from './client.js';
export { BoundedQueue } from './queue.js';
export { HttpLongPollTransport, type LongPollConfig, type CommandHandler } from './longpoll.js';
export { useTransportStatus, getStatusDisplay, type TransportStatusDisplay } from './status.js';
