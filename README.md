# @sam-ael/medusa-plugin-whatsapp

A production-focused WhatsApp notification plugin for **Medusa v2** featuring custom event mapping, template dispatching, and admin-managed operational controls.

[Medusa Website](https://medusajs.com/) | [Medusa Repository](https://github.com/medusajs/medusa)

---

## Features

- **Admin-Managed Mappings:** Link any internal Medusa event to an approved WhatsApp message template via the settings dashboard.
- **Official WhatsApp Cloud API Integration:** Send message templates using official Facebook/Meta business accounts.
- **Redacted Delivery Logs:** View transmission statuses and records directly in the admin panel with sensitive user data automatically redacted.
- **Workflow-Driven Execution:** Dispatches messages via workflow engine, enabling reliable asynchronous delivery in background workers.
- **Enhanced Security:** Keeps authorization secrets (`WHATSAPP_ACCESS_TOKEN`) strictly environment-bound and off the database or API responses.
- **Rate & Concurrency Limits:** Features configurable delivery concurrency limits and connection timeout controls.

---

## Prerequisites

- [Node.js v18 or greater](https://nodejs.org/en)
- [A Medusa v2 backend](https://docs.medusajs.com/v2)
- A Meta Developer Account with the WhatsApp Business platform set up
- A verified WhatsApp Phone Number ID and System User Access Token

---

## Installation

Run the following command to install the plugin in your Medusa project:

```bash
yarn add @sam-ael/medusa-plugin-whatsapp
```

---

## Configuration

### 1. Register in `medusa-config.ts`

Add the plugin configuration block to your `medusa-config.ts` file:

```ts
const plugins = [
  // ... other plugins
  {
    resolve: "@sam-ael/medusa-plugin-whatsapp",
    options: {},
  },
]
```

### 2. Environment Variables

Define the Meta WhatsApp Cloud API credentials in your `.env` file:

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_API_VERSION=v25.0
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id

# Concurrency & cleanups
WHATSAPP_SEND_CONCURRENCY=2
WHATSAPP_API_TIMEOUT_MS=15000
WHATSAPP_LOG_RETENTION_DAYS=30
```

### 3. Run Migrations

To initialize the WhatsApp event mapping and transmission log schemas in your database, run:

```bash
npx medusa db:migrate
```

---

## Webhooks & API Reference

WhatsApp notifications are outbound messages sent by your Medusa server to customers' phones. This plugin does not accept incoming webhooks from Meta.

### Admin API Endpoints

Use these endpoints to programmatically manage your notifications and channels (which are also accessible via the built-in Settings UI).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/whatsapp/config` | View active non-secret config settings |
| `POST` | `/admin/whatsapp/config` | Update non-secret config options |
| `GET` | `/admin/whatsapp/templates` | Fetch approved WhatsApp Business templates from Meta |
| `GET` | `/admin/whatsapp/mappings` | List active event mappings (paginated) |
| `POST` | `/admin/whatsapp/mappings` | Create a new event mapping |
| `POST` | `/admin/whatsapp/mappings/:id` | Update an existing mapping (primary endpoint) |
| `DELETE` | `/admin/whatsapp/mappings/:id` | Delete a mapping |
| `GET` | `/admin/whatsapp/logs` | View message delivery logs |
| `POST` | `/admin/whatsapp/manual` | Dispatch a manual/test template message |

---

## Test the Plugin

1. Ensure your `.env` contains valid WhatsApp Phone Number ID and Access Token credentials (you can use a Meta test number).
2. Start your Medusa development server.
3. Log in to the Medusa Admin panel and navigate to Settings → WhatsApp.
4. Verify you can fetch templates from your Meta account.
5. Create a mapping for `order.placed` matching one of your templates.
6. Dispatch a test message manually via the settings dashboard using a valid recipient phone number.
7. Verify receipt of the message on the recipient device.
