<p align="center">
  <img src="https://img.shields.io/npm/v/@sam-ael/medusa-plugin-whatsapp?style=flat-square&color=25D366" alt="npm version" />
  <img src="https://img.shields.io/badge/medusa-v2-7C3AED?style=flat-square" alt="Medusa v2" />
  <img src="https://img.shields.io/badge/WhatsApp_Cloud_API-v25.0-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp API v25.0" />
  <img src="https://img.shields.io/npm/l/@sam-ael/medusa-plugin-whatsapp?style=flat-square" alt="license" />
</p>

# @sam-ael/medusa-plugin-whatsapp

A **MedusaJS v2 plugin** for sending WhatsApp Business template messages to customers when store events happen — like order placements, fulfillments, returns, and more.

Map any Medusa event to a WhatsApp template, configure recipient logic, and manage everything from a built-in admin dashboard. No code required after installation.

---

## Features

- 📱 **WhatsApp Cloud API** — Sends template messages through the official WhatsApp Business Cloud API (v25.0)
- 🗺️ **Event → Template Mapping** — Map Medusa events (`order.placed`, `fulfillment.created`, etc.) to your WhatsApp templates from the admin UI
- 🎛️ **Admin Dashboard** — Full configuration page inside the Medusa admin panel with no extra setup
- 📋 **Message Logs** — Every sent (and failed) message is logged with request/response payloads for debugging
- 🧪 **Test Messages** — Send test template messages directly from the admin UI before going live
- 📦 **Template Variables** — Map dynamic order data (order ID, customer name, total, etc.) to WhatsApp template body parameters
- 📞 **Smart Recipient Resolution** — Automatically resolves phone numbers from billing address, shipping address, or customer profile
- 🔑 **Flexible Configuration** — Configure via the admin UI, environment variables, or both (DB config takes priority)
- 🏗️ **Zero Dependencies** — Uses native `fetch` — no external HTTP libraries needed

---

## Supported Events

The plugin listens to the following events out of the box. You can also type in any custom event name in the admin UI.

| Category | Events |
|---|---|
| **Orders** | `order.placed` · `order.completed` · `order.canceled` · `order.updated` · `order.fulfillment_created` |
| **Fulfillment** | `fulfillment.created` · `fulfillment.shipment_created` · `fulfillment.delivery_created` |
| **Customers** | `customer.created` · `customer.updated` |
| **Returns & Claims** | `return.created` · `return.received` · `claim.created` · `exchange.created` |

---

## Prerequisites

- **MedusaJS v2** (`>= 2.x`)
- A **WhatsApp Business Account** with access to the [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- A **Phone Number ID** and **Access Token** from the [Meta Developer Console](https://developers.facebook.com/apps/)
- At least one **approved WhatsApp template** in your Business Manager

---

## Installation

```bash
yarn add @sam-ael/medusa-plugin-whatsapp
```

Or with npm:

```bash
npm install @sam-ael/medusa-plugin-whatsapp
```

---

## Configuration

### 1. Add the plugin to `medusa-config.ts`

```ts
plugins: [
  {
    resolve: "@sam-ael/medusa-plugin-whatsapp",
    options: {},
  },
]
```

### 2. Set environment variables

Add these to your `.env` file:

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_API_VERSION=v25.0         # optional, defaults to v25.0
```

> **Note:** You can also configure these through the admin dashboard. Database-stored config takes priority over environment variables.

### 3. Run migrations

```bash
npx medusa db:migrate
```

### 4. Start Medusa

```bash
npx medusa develop
```

Navigate to **WhatsApp** in the admin sidebar to configure and start mapping events.

---

## Admin Dashboard

The plugin adds a **WhatsApp** page to the Medusa admin panel with four sections:

### Configuration

Set your WhatsApp Cloud API credentials, API version, and default language code. Toggle the integration on/off.

### Event → Template Mappings

Create rules that map Medusa events to WhatsApp templates:

- Select a Medusa event (or type a custom one)
- Enter the WhatsApp template name (as it appears in your Business Manager)
- Set the language code
- Choose the recipient type:
  - **Billing phone** (fallback: shipping) — default
  - **Billing phone only**
  - **Shipping phone only**
  - **Custom phone number** — for sending to a fixed number (e.g., store owner notifications)
- Map up to 5 template variables to order data paths (e.g., `order.display_id`, `order.total`, `order.customer.first_name`)

### Test Messages

Send a template message to any phone number directly from the admin UI — useful for verifying your templates work before enabling event mappings.

### Message Logs

View a log of all sent and failed messages, including timestamps, recipient, status, and the event that triggered them.

---

## Template Variables

When creating a mapping, you can map WhatsApp template body parameters to data from the event. Use dot-notation paths to reference nested data:

| Path | Description |
|---|---|
| `order.display_id` | Human-readable order number |
| `order.total` | Order total amount |
| `order.currency_code` | Currency code (e.g., `INR`, `USD`) |
| `order.email` | Order contact email |
| `order.shipping_address.first_name` | Shipping first name |
| `order.shipping_address.last_name` | Shipping last name |
| `order.shipping_address.phone` | Shipping phone |
| `order.shipping_address.city` | Shipping city |
| `order.billing_address.first_name` | Billing first name |
| `order.billing_address.last_name` | Billing last name |
| `order.billing_address.phone` | Billing phone |
| `order.customer.first_name` | Customer first name |
| `order.customer.last_name` | Customer last name |
| `order.customer.email` | Customer email |
| `order.customer.phone` | Customer phone |

You can also type any custom dot-path to reference data specific to your event payloads.

---

## API Routes

The plugin exposes the following admin API routes (all require authentication):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/whatsapp/config` | Get current WhatsApp configuration |
| `POST` | `/admin/whatsapp/config` | Create or update configuration |
| `GET` | `/admin/whatsapp/mappings` | List all event → template mappings |
| `POST` | `/admin/whatsapp/mappings` | Create a new mapping |
| `PUT` | `/admin/whatsapp/mappings/:id` | Update a mapping |
| `DELETE` | `/admin/whatsapp/mappings/:id` | Delete a mapping |
| `GET` | `/admin/whatsapp/logs` | Get message logs |
| `POST` | `/admin/whatsapp/test` | Send a test message |

---

## How It Works

1. A Medusa event fires (e.g., `order.placed`)
2. The subscriber checks if a WhatsApp config is active (DB → env vars fallback)
3. It looks up all active event mappings for that event
4. For each mapping, it resolves the recipient phone number based on the `recipient_type`
5. It builds the WhatsApp Cloud API payload with template name, language, and variable parameters
6. It sends the request to `https://graph.facebook.com/v25.0/{phone_number_id}/messages`
7. The result (success or failure) is logged to the `whatsapp_message_log` table

---

## Database Schema

The plugin creates three tables:

| Table | Purpose |
|---|---|
| `whatsapp_config` | Stores API credentials and settings (phone number ID, access token, API version, language, active toggle) |
| `whatsapp_event_mapping` | Maps events to templates with recipient type, language, and variable configuration |
| `whatsapp_message_log` | Logs every message attempt with status, payloads, and WhatsApp message ID |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | Yes* | — | Your WhatsApp Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Yes* | — | Your WhatsApp Cloud API access token |
| `WHATSAPP_API_VERSION` | No | `v25.0` | Facebook Graph API version |

\* *Not required if configured through the admin dashboard.*

---

## License

MIT — see [LICENSE](./LICENSE) for details.
