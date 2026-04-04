import Docker from 'dockerode'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  ports: { internal: number; external?: number }[]
  networks: string[]
  status: string
}

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

export async function listRunningContainers(): Promise<ContainerInfo[]> {
  const containers = await docker.listContainers()
  return containers.map((c) => ({
    id: c.Id,
    name: (c.Names[0] ?? '').replace(/^\//, ''),
    image: c.Image,
    ports: c.Ports.map((p) => ({ internal: p.PrivatePort, external: p.PublicPort })),
    networks: Object.keys(c.NetworkSettings.Networks),
    status: c.Status,
  }))
}
