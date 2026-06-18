import type { PlanTier, DBEngine } from './types.js';

export interface PlanConfig {
  tier: PlanTier;
  label: string;
  cpuMillicores: number;
  memoryMB: number;
  storageGB: number;
  maxReplicas: number;
  maxConnections: number;
  pricePerHour: number;
  features: string[];
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free', label: 'Free',
    cpuMillicores: 250, memoryMB: 256, storageGB: 1,
    maxReplicas: 1, maxConnections: 10, pricePerHour: 0,
    features: ['1 database', '1 GB storage', 'No replicas', 'Community support'],
  },
  starter: {
    tier: 'starter', label: 'Starter',
    cpuMillicores: 500, memoryMB: 1024, storageGB: 10,
    maxReplicas: 2, maxConnections: 100, pricePerHour: 0.025,
    features: ['Up to 2 replicas', '10 GB storage', 'Daily backups', 'Email support'],
  },
  pro: {
    tier: 'pro', label: 'Pro',
    cpuMillicores: 2000, memoryMB: 4096, storageGB: 100,
    maxReplicas: 5, maxConnections: 500, pricePerHour: 0.15,
    features: ['Up to 5 replicas', '100 GB storage', 'Autoscaling', 'Connection pooling', 'Priority support'],
  },
  enterprise: {
    tier: 'enterprise', label: 'Enterprise',
    cpuMillicores: 8000, memoryMB: 16384, storageGB: 1000,
    maxReplicas: 20, maxConnections: 5000, pricePerHour: 0.85,
    features: ['Up to 20 replicas', '1 TB storage', 'Custom autoscaling', 'HA', 'SLA 99.99%', 'Dedicated support'],
  },
};

export const ENGINE_VERSIONS: Record<DBEngine, string[]> = {
  postgresql: ['16', '15', '14', '13'],
  mysql:      ['8.4', '8.0', '5.7'],
  redis:      ['7.2', '7.0', '6.2'],
  mongodb:    ['7.0', '6.0', '5.0'],
};

export const ENGINE_PORTS: Record<DBEngine, number> = {
  postgresql: 5432,
  mysql:      3306,
  redis:      6379,
  mongodb:    27017,
};

export const REGIONS = [
  { id: 'us-east-1',      label: 'US East (N. Virginia)',      flag: '🇺🇸' },
  { id: 'us-west-2',      label: 'US West (Oregon)',           flag: '🇺🇸' },
  { id: 'eu-west-1',      label: 'EU West (Ireland)',          flag: '🇪🇺' },
  { id: 'ap-south-1',     label: 'Asia Pacific (Mumbai)',      flag: '🇮🇳' },
  { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)',   flag: '🇸🇬' },
];
