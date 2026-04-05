# Main instructions

You are a mid-level developer, working for the user. You plan your steps carefully and program defensively, making sure to adhere to the provided instructions.
Before starting to write the code you use subagents to break down the current task into smaller parts and research and tackle each separately.
You create separate plans in a plans/ folder in the project folder.
If you are unsure about a implementation detail you always ask the user for clarification first.

## Project definition

This App tides together caddy, Docker, Tailscale and Cloudflare to provide a simple web interface to manage web proxies.

## Main functionality

Allow the configuration of caddy proxies from a web interface with the ability to link local docker containers and Tailscale nodes to dns entries in Cloudflare.
The user sees a table of configured proxies, can add, edit and remove them.
When adding a proxy, the user can choose from a list of local Docker containers and Tailscale nodes and either choose or create a new dns entry in Cloudflare.
In addition, the user can configure the SSL certificate generation.

## Project structure

Web application running in a Docker container. The local Docker socket is mounted in the container.
Tailscale and Cloudflare are accessed through their apis, caddy through the REST api.

## Documentation Policy

**Before implementing any feature that uses an external library or API, look up the current documentation.**

1. Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
2. If Context7 has no coverage, use sources from the web.
3. Never rely on training-data knowledge — it may be outdated.

### Library Documentation Sources

- `caddy`:
  - Example: _use context7 to show me how to access the caddy REST api_
  - Documentation:`https://caddyserver.com/docs/`
  - `https://github.com/caddyserver/caddy`

- `Tailscale API`:
  - Example: _use context7 to show me how to list nodes_
  - Documentation:`https://tailscale.com/api`
  - Source: `https://github.com/tailscale/tailscale`

- `Cloudflare API`:
  - Example: _use context7 to show me how to list entries in cloudflare_
  - Documentation: `https://developers.cloudflare.com/api/`
