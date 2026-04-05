export interface Proxy {
  id: string;
  domain: string;
  upstream: {
    type: 'docker' | 'tailscale' | 'manual';
    ref: string;
    port: number;
    publicIp?: string;
  };
  cloudflare: {
    zoneId: string;
    recordId: string;
  };
  tls: {
    enabled: boolean;
    email?: string;
  };
  createdAt: string;
  /** Client-only: true while an optimistic create is in flight */
  _pending?: boolean;
}

export interface CreateProxyInput {
  domain: string;
  upstream: { type: 'docker' | 'tailscale' | 'manual'; ref: string; port: number; publicIp?: string };
  cloudflare: { zoneId: string; recordId?: string };
  tls: { enabled: boolean; email?: string };
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  ports: Array<{ internal: number; external?: number }>;
  networks: string[];
  networkIps: Record<string, string>;
  status: string;
}

export interface TailscaleNode {
  id: string;
  hostname: string;
  name: string;
  ipv4: string | null;
  ipv6: string | null;
  os: string;
  online: boolean;
}

export interface Zone {
  id: string;
  name: string;
  status: string;
}

export interface DnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  proxied: boolean;
}

export interface ProxyStatusResult {
  status: 'active' | 'error';
  reason?: string;
}

export interface AppConfig {
  acmeEmail: string;
}

export interface ExternalIps {
  tailscale: string | null;
  public: string | null;
}

// Frontend-only: visual states including loading
export type ProxyStatus = 'active' | 'error' | 'loading';
