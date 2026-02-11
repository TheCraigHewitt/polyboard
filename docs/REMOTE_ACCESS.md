# Remote Access Setup

Polyboard supports secure remote access from other machines on your network or over the internet.

## Quick Start with Tailscale (Recommended)

Tailscale provides encrypted networking with zero config. Each machine gets a stable IP (e.g., `100.x.y.z`).

1. Install Tailscale on both machines
2. Generate a TLS cert for your Tailscale hostname:
   ```bash
   tailscale cert $(tailscale status --self --json | jq -r '.Self.DNSName' | sed 's/\.$//')
   ```
3. Start Polyboard:
   ```bash
   HOST=0.0.0.0 \
   POLYBOARD_API_TOKEN="your-secret-token" \
   POLYBOARD_TLS_CERT=./machine-name.ts.net.crt \
   POLYBOARD_TLS_KEY=./machine-name.ts.net.key \
   polyboard
   ```
4. Access from any Tailscale device: `https://machine-name.ts.net:3001`

## Self-Signed Certificate

For local network access without Tailscale:

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=polyboard"
```

Then start with:
```bash
HOST=0.0.0.0 \
POLYBOARD_API_TOKEN="your-secret-token" \
POLYBOARD_TLS_CERT=./cert.pem \
POLYBOARD_TLS_KEY=./key.pem \
polyboard
```

Your browser will show a certificate warning -- accept it to proceed.

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `HOST` | No | `127.0.0.1` | Bind address. Set to `0.0.0.0` for remote access |
| `PORT` | No | `3001` | Server port |
| `POLYBOARD_API_TOKEN` | **Yes*** | - | API authentication token |
| `POLYBOARD_TLS_CERT` | **Yes*** | - | Path to TLS certificate PEM file |
| `POLYBOARD_TLS_KEY` | **Yes*** | - | Path to TLS private key PEM file |
| `POLYBOARD_TLS_CA` | No | - | Path to CA cert for mutual TLS (client cert verification) |
| `POLYBOARD_SESSION_SECRET` | No | derived from API token | Secret for signing session cookies |
| `POLYBOARD_CORS_ORIGINS` | No | - | Comma-separated list of allowed CORS origins |

*Required when `HOST` is non-loopback. The server will refuse to start without both token and TLS on a non-loopback address.

## Authentication

When `POLYBOARD_API_TOKEN` is set, Polyboard shows a login page. Enter the token to authenticate. Sessions are maintained via httpOnly cookies.

API clients can also authenticate via bearer token:
```bash
curl -H "Authorization: Bearer your-token" https://host:3001/api/config
```

## VPS Deployment

For a VPS with a real domain and Let's Encrypt:

```bash
# Get cert via certbot
sudo certbot certonly --standalone -d polyboard.example.com

# Start Polyboard
HOST=0.0.0.0 \
PORT=443 \
POLYBOARD_API_TOKEN="$(openssl rand -hex 32)" \
POLYBOARD_TLS_CERT=/etc/letsencrypt/live/polyboard.example.com/fullchain.pem \
POLYBOARD_TLS_KEY=/etc/letsencrypt/live/polyboard.example.com/privkey.pem \
POLYBOARD_CORS_ORIGINS=https://polyboard.example.com \
polyboard
```

## Cloudflare Tunnel

If using Cloudflare Tunnel, the tunnel terminates TLS. You still need TLS between the tunnel and Polyboard:

```bash
HOST=127.0.0.1 \
POLYBOARD_API_TOKEN="your-secret-token" \
polyboard
```

Then configure `cloudflared` to proxy to `http://127.0.0.1:3001`. Since the connection is loopback, TLS is not required.

## Security Notes

- Non-loopback binding enforces both token auth AND TLS -- the server will not start without them
- Session cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` (when TLS is active)
- Login endpoint is rate limited to 5 attempts per IP per 60 seconds
- CSRF protection verifies `Origin` header on mutating requests with cookie auth
- Security headers are set via `helmet` (CSP, HSTS, X-Frame-Options, etc.)
- Mutual TLS (mTLS) is supported via `POLYBOARD_TLS_CA` for client certificate verification
