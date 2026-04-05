1. Fix error: "Failed to load Tailscale nodes". Provide additional debugging information in the stdout.
2. Container list dropdown: make the list wider -> at least so wide as the widest name & container name
3. Cloudflare zone dropdown: automatically select the first available zone. then, instad of showing an id, show the zone name.
4. When choosing "create new a record", if a domain has already been entered, check if the record exists already and display a warning.
5. A records dropdown list: make the list wider so that the entire longest record can be displayed.
6. When enable TLS is toggled, show the configured ACME_EMAIL adress, if available.
7. When a docker container is chosen and it exposes only one port, show only that, when more than one, show a drop down list, but also allow setting a custom port.