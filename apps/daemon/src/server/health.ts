/**
 * Daemon Health & Prometheus-Lite Metrics (PRD FR-301, NFR-109, TRD §7.2).
 */

export interface DaemonMetrics {
  startTime: number;
  totalRequests: number;
  activeSessions: number;
  extensionConnected: boolean;
}

export const metrics: DaemonMetrics = {
  startTime: Date.now(),
  totalRequests: 0,
  activeSessions: 0,
  extensionConnected: false,
};

export function getHealthz(): {
  status: string;
  uptime: number;
  uptimeSec: number;
  extensionConnected: boolean;
} {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  return {
    status: 'ok',
    uptime,
    uptimeSec: uptime,
    extensionConnected: metrics.extensionConnected,
  };
}

export function getReadyz(): { status: string; ready: boolean; extensionConnected: boolean } {
  return {
    status: metrics.extensionConnected ? 'ready' : 'not_ready',
    ready: metrics.extensionConnected,
    extensionConnected: metrics.extensionConnected,
  };
}

export function getVersion(): { version: string; protocolVersion: string } {
  return {
    version: '0.1.0',
    protocolVersion: '1.0.0',
  };
}

export function getMetricsPrometheus(): string {
  const uptime = Math.floor((Date.now() - metrics.startTime) / 1000);
  return [
    '# HELP tether_daemon_uptime_seconds Total daemon uptime in seconds',
    '# TYPE tether_daemon_uptime_seconds counter',
    `tether_daemon_uptime_seconds ${uptime}`,
    '# HELP tether_requests_total Total tool and system requests',
    '# TYPE tether_requests_total counter',
    `tether_requests_total ${metrics.totalRequests}`,
    '# HELP tether_daemon_requests_total Total tool and system requests',
    '# TYPE tether_daemon_requests_total counter',
    `tether_daemon_requests_total ${metrics.totalRequests}`,
    '# HELP tether_active_connections Currently active client connections',
    '# TYPE tether_active_connections gauge',
    `tether_active_connections ${metrics.activeSessions}`,
    '# HELP tether_daemon_active_sessions Currently active client sessions',
    '# TYPE tether_daemon_active_sessions gauge',
    `tether_daemon_active_sessions ${metrics.activeSessions}`,
    '# HELP tether_daemon_extension_connected Chrome extension connection status',
    '# TYPE tether_daemon_extension_connected gauge',
    `tether_daemon_extension_connected ${metrics.extensionConnected ? 1 : 0}`,
    '',
  ].join('\n');
}
