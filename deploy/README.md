# Deploy recipes

Reference configs for running codenanny in production. Copy what you need, replace the placeholders, edit to taste.

These are not "the one true way" — they are **one true way that has been proven in prod**. The exact recipe here is what runs codenanny behind authentication on a multi-tenant operator workspace, surviving disconnects and reboots.

## Recipe: codenanny behind nginx auth on a remote host

**Problem.** You have a private box (laptop, dev VM, home server) that holds your `~/.claude/projects` transcripts. You want codenanny reachable from the open internet through your own dashboard — but only to *you*, with the same login your other tools already use, and with codenanny itself never exposed directly.

**Shape.**

```
  [ private box ]                                    [ public host ]
                                                                   
  codenanny  ──────► PM2 ──────► autossh -R ─────► nginx ─────► browser
  (127.0.0.1:7700)                  (reverse SSH      (auth_request +
                                     tunnel)          proxy_pass)     
```

- **codenanny** runs on the private box, bound to `127.0.0.1:7700`. Never exposed directly.
- **PM2** keeps codenanny alive and restarts it after crashes. Hooked into systemd so it survives reboot.
- **autossh** (under systemd) holds a persistent reverse SSH tunnel from the private box into the public host, forwarding remote `127.0.0.1:7700` to local `127.0.0.1:7700`.
- **nginx** on the public host proxies `https://your.host/codenanny/` to the tunneled port, gated by an `auth_request` against your existing session cookie.

The public host never holds codenanny data. The private box never opens a port to the internet. Auth is delegated to your existing login.

## Files

| File | What it is | Where it goes |
|---|---|---|
| [`pm2-ecosystem.config.cjs.example`](pm2-ecosystem.config.cjs.example) | PM2 config that starts `codenanny serve` | Private box, anywhere PM2 can `pm2 start` it |
| [`codenanny-tunnel.service.example`](codenanny-tunnel.service.example) | systemd unit running `autossh -R` | Private box, `/etc/systemd/system/codenanny-tunnel.service` |
| [`nginx-auth-snippet.conf.example`](nginx-auth-snippet.conf.example) | nginx `location /codenanny/` with `auth_request` | Public host, inside your `server { ... }` block |

## Wire-up walkthrough

Replace every `{{PLACEHOLDER}}` in the examples before copying.

### 1. Start codenanny under PM2 (private box)

```bash
# from your codenanny checkout
cp deploy/pm2-ecosystem.config.cjs.example /opt/codenanny/ecosystem.config.cjs
# edit DB path + src path to match your box
pm2 start /opt/codenanny/ecosystem.config.cjs
pm2 save                                     # freeze process list
pm2 startup systemd -u root --hp /root       # install systemd boot hook
                                             # ↑ run the command pm2 prints
```

Verify: `curl http://127.0.0.1:7700/` → HTML.

### 2. Install the autossh tunnel (private box)

```bash
sudo cp deploy/codenanny-tunnel.service.example /etc/systemd/system/codenanny-tunnel.service
sudo $EDITOR /etc/systemd/system/codenanny-tunnel.service     # fill placeholders
sudo systemctl daemon-reload
sudo systemctl enable --now codenanny-tunnel
sudo systemctl status codenanny-tunnel
```

Requirements:
- `autossh` installed (`apt-get install autossh`).
- An SSH key on the private box that can log into the public host non-interactively.
- The public host's `sshd_config` must allow `AllowTcpForwarding yes` (default).

Verify from the **public host**: `curl http://127.0.0.1:7700/` → same HTML codenanny served on the private box.

### 3. Front it with nginx auth (public host)

You need an auth backend that returns `200` for authenticated requests and `401`/`403` for anonymous ones. Most session-cookie systems can provide this with a tiny endpoint that just checks the session and returns no body — e.g. `GET /auth/check → 200` or `401`.

```bash
# inside your existing server { listen 443 ssl; server_name your.host; ... } block:
sudo $EDITOR /etc/nginx/sites-available/your-host
# paste the contents of deploy/nginx-auth-snippet.conf.example
# adjust auth_request target + redirect URL
sudo nginx -t && sudo systemctl reload nginx
```

Verify:
- Anonymous: `curl -sk -o /dev/null -w '%{http_code}\n' https://your.host/codenanny/` → `302` (or `401`)
- Logged in (with session cookie): `curl -sk -o /dev/null -w '%{http_code}\n' --cookie 'session=...' https://your.host/codenanny/` → `200`

### 4. Reboot-test

```bash
sudo reboot
# wait, then:
ssh private-box 'systemctl is-active codenanny-tunnel pm2-root && pm2 list | grep codenanny'
curl -sk https://your.host/codenanny/ -o /dev/null -w '%{http_code}\n'   # 302 unauth
```

All three should be healthy with no manual intervention. If PM2 doesn't list codenanny after reboot, you forgot `pm2 save` after starting it.

## Troubleshooting checklist

Diagnostic order, fastest to slowest:

1. `systemctl status codenanny-tunnel` — tunnel up?
2. `pm2 list | grep codenanny` — server up?
3. `curl http://127.0.0.1:7700/` on private box — codenanny answering locally?
4. `curl http://127.0.0.1:7700/` on public host — did the reverse forward survive?
5. `curl -sk https://your.host/codenanny/` — auth gate behavior matches expectation?

The most common silent failure is **stale PM2 dump**: you `pm2 delete codenanny`, change config, `pm2 start` again, but forget `pm2 save`. The next reboot resurrects the old process list without codenanny, and nothing seems wrong until you look.

## Alternatives

- **Cloudflare Tunnel / Tailscale Funnel** instead of autossh — same shape, different transport. Use these if you don't want to manage SSH keys.
- **OAuth2 Proxy** instead of `auth_request` — heavier but speaks IdP protocols natively.
- **Caddy** instead of nginx — `forward_auth` directive does the same thing in fewer lines.

The codenanny side of the recipe (PM2 + bind to 127.0.0.1) doesn't change.
