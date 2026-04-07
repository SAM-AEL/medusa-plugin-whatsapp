<p align="center">
  <img src="https://img.shields.io/npm/v/@sam-ael/medusa-plugin-whatsapp?style=flat-square&color=16A34A" alt="npm version" />
  <img src="https://img.shields.io/badge/medusa-v2-0F172A?style=flat-square" alt="Medusa v2" />
  <img src="https://img.shields.io/badge/category-notification-0F766E?style=flat-square" alt="notification plugin" />
  <img src="https://img.shields.io/npm/l/@sam-ael/medusa-plugin-whatsapp?style=flat-square" alt="license" />
</p>

# @sam-ael/medusa-plugin-whatsapp

Production-focused WhatsApp notification plugin for Medusa v2 with event mapping, template dispatch, and admin-managed operational controls.

## Highlights

- Event -> template mapping from Medusa Admin
- WhatsApp Cloud API template sending
- Delivery logs with redacted sensitive fields
- Workflow-driven delivery for worker deployments
- Hardened API responses and stricter payload validation
- `POST /admin/whatsapp/mappings/:id` as the primary update endpoint
- Temporary deprecated `PUT` compatibility with deprecation headers
- Secret model hardening: access token is env-only

## Install

```bash
yarn add @sam-ael/medusa-plugin-whatsapp
```

## Medusa Configuration

```ts
plugins: [
  {
    resolve: "@sam-ael/medusa-plugin-whatsapp",
    options: {},
  },
]
```

## Environment Variables

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_API_VERSION=v25.0
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id

WHATSAPP_SEND_CONCURRENCY=2
WHATSAPP_API_TIMEOUT_MS=15000
WHATSAPP_LOG_RETENTION_DAYS=30
```

## Admin API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/whatsapp/config` | Read non-secret config |
| `POST` | `/admin/whatsapp/config` | Create/update non-secret config |
| `GET` | `/admin/whatsapp/templates` | Fetch approved WhatsApp templates |
| `GET` | `/admin/whatsapp/mappings` | List mappings (paginated) |
| `POST` | `/admin/whatsapp/mappings` | Create mapping |
| `POST` | `/admin/whatsapp/mappings/:id` | Update mapping (primary) |
| `PUT` | `/admin/whatsapp/mappings/:id` | Deprecated compatibility endpoint |
| `DELETE` | `/admin/whatsapp/mappings/:id` | Delete mapping |
| `GET` | `/admin/whatsapp/logs` | List message logs (redacted payloads) |
| `POST` | `/admin/whatsapp/manual` | Manual/test message send |

## Security and Reliability Notes

- Unified error contract: `{ success: false, code, message, details? }`
- `WHATSAPP_ACCESS_TOKEN` is not accepted in API payloads and is not persisted in DB
- Redaction policy applied to sensitive request/response payload fields
- Event-send workflow uses bounded concurrency and per-item failure isolation
- Timeout controls and retention cleanup job included
- Indexes added for high-frequency lookup fields

## Quality Gates

```bash
yarn typecheck
yarn lint
yarn test
yarn build
```

Smoke tests are available under `src/tests`.

## License

MIT
