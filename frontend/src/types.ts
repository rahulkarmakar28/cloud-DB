export type DBEngine = 'postgresql' | 'mysql' | 'redis' | 'mongodb';
export type Region   = 'us-east-1' | 'us-west-2' | 'eu-west-1' | 'ap-south-1' | 'ap-southeast-1';
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type DBStatus = 'provisioning' | 'running' | 'scaling' | 'paused' | 'error' | 'terminated';

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface DatabaseConfig {
  engine: DBEngine; version: string; region: Region; plan: PlanTier;
  replicas: number; storageGB: number; cpuMillicores: number; memoryMB: number;
  autoscaling: boolean; maxReplicas: number; connectionPooling: boolean;
  maxConnections: number; backupEnabled: boolean; backupRetentionDays: number;
  highAvailability: boolean; readReplicas: number; name: string;
}

export interface DatabaseInstance {
  id: string; userId: string; name: string; config: DatabaseConfig;
  status: DBStatus; connectionString: string;
  readReplicaConnectionStrings: string[];
  host: string; port: number; database: string; username: string; password: string;
  createdAt: string; updatedAt: string;
  kubernetesNamespace: string; kubernetesDeploymentName: string;
}

export interface PlanConfig {
  tier: PlanTier; label: string; cpuMillicores: number; memoryMB: number;
  storageGB: number; maxReplicas: number; maxConnections: number;
  pricePerHour: number; features: string[];
}

export interface CreateDatabaseForm {
  name: string; engine: DBEngine; version: string; region: Region; plan: PlanTier;
  replicas: number; storageGB: number; autoscaling: boolean; maxReplicas: number;
  connectionPooling: boolean; maxConnections: number; backupEnabled: boolean;
  backupRetentionDays: number; highAvailability: boolean; readReplicas: number;
}

export interface MetricPoint {
  timestamp: string; cpu: number; memory: number; connections: number; qps: number;
}
