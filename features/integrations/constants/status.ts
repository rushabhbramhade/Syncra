export interface StatusConfig {
  label: string;
  className: string;
  pulse: boolean;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  connected: {
    label: "Connected",
    className: "bg-success-bg border-success text-success",
    pulse: true,
  },
  syncing: {
    label: "Syncing",
    className: "bg-info-bg border-info text-info",
    pulse: true,
  },
  expired: {
    label: "Expired",
    className: "bg-warning-bg border-warning text-warning",
    pulse: false,
  },
  error: {
    label: "Error",
    className: "bg-error-bg border-error text-error",
    pulse: false,
  },
  connecting: {
    label: "Connecting",
    className: "bg-info-bg border-info text-info",
    pulse: true,
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-background-mist border-border-mist text-text-slate",
    pulse: false,
  },
};

export const SYNC_STATUS_LABEL: Record<string, string> = {
  idle: "Idle",
  syncing: "Syncing",
  success: "Connected",
  error: "Error",
  expired: "Expired",
};
