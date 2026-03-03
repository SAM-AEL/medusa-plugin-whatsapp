declare const __BACKEND_URL__: string | undefined

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Container, Heading, Button, Input, Label, Switch, Table, Badge, Text, Select, Toaster, toast } from "@medusajs/ui"
import { useState, useEffect, useCallback } from "react"

const MEDUSA_EVENTS = [
    "order.placed",
    "order.completed",
    "order.canceled",
    "order.updated",
    "order.fulfillment_created",
    "fulfillment.created",
    "fulfillment.shipment_created",
    "fulfillment.delivery_created",
    "customer.created",
    "customer.updated",
    "return.created",
    "return.received",
    "claim.created",
    "exchange.created",
]

const BACKEND_URL = __BACKEND_URL__ ?? ""

async function api(path: string, options?: RequestInit) {
    const res = await fetch(`${BACKEND_URL}/admin/whatsapp${path}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    })
    return res.json()
}

// ─── Configuration Section ─────────────────────────────────────
function ConfigSection() {
    const [config, setConfig] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        phone_number_id: "",
        access_token: "",
        api_version: "v25.0",
        default_language_code: "en_US",
        active: true,
    })

    const loadConfig = useCallback(async () => {
        setLoading(true)
        const data = await api("/config")
        if (data.config) {
            setConfig(data.config)
            setForm({
                phone_number_id: data.config.phone_number_id || "",
                access_token: "",
                api_version: data.config.api_version || "v25.0",
                default_language_code: data.config.default_language_code || "en_US",
                active: data.config.active ?? true,
            })
        }
        setLoading(false)
    }, [])

    useEffect(() => { loadConfig() }, [loadConfig])

    const saveConfig = async () => {
        setSaving(true)
        const payload: any = { ...form }
        if (!payload.access_token) delete payload.access_token
        await api("/config", { method: "POST", body: JSON.stringify(payload) })
        toast.success("Configuration saved")
        await loadConfig()
        setSaving(false)
    }

    if (loading) return <Text>Loading configuration...</Text>

    return (
        <Container className="p-6">
            <div className="flex items-center justify-between mb-4">
                <Heading level="h2">WhatsApp Configuration</Heading>
                <div className="flex items-center gap-2">
                    <Label htmlFor="wa-active">Active</Label>
                    <Switch
                        id="wa-active"
                        checked={form.active}
                        onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="phone-id">Phone Number ID</Label>
                    <Input
                        id="phone-id"
                        placeholder="e.g. 1234567890"
                        value={form.phone_number_id}
                        onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                    />
                </div>
                <div>
                    <Label htmlFor="access-token">
                        Access Token {config && <Text size="small" className="text-ui-fg-muted">(leave blank to keep current)</Text>}
                    </Label>
                    <Input
                        id="access-token"
                        type="password"
                        placeholder={config ? "••••••••" : "Bearer token"}
                        value={form.access_token}
                        onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                    />
                </div>
                <div>
                    <Label htmlFor="api-version">API Version</Label>
                    <Input
                        id="api-version"
                        placeholder="v25.0"
                        value={form.api_version}
                        onChange={(e) => setForm({ ...form, api_version: e.target.value })}
                    />
                </div>
                <div>
                    <Label htmlFor="lang-code">Default Language Code</Label>
                    <Input
                        id="lang-code"
                        placeholder="en_US"
                        value={form.default_language_code}
                        onChange={(e) => setForm({ ...form, default_language_code: e.target.value })}
                    />
                </div>
            </div>

            <div className="mt-4 flex justify-end">
                <Button onClick={saveConfig} isLoading={saving}>
                    Save Configuration
                </Button>
            </div>

            {config && (
                <div className="mt-3">
                    <Text size="small" className="text-ui-fg-muted">
                        Current token: {config.access_token}
                    </Text>
                </div>
            )}
        </Container>
    )
}

// ─── Event Mappings Section ─────────────────────────────────────
const RECIPIENT_OPTIONS = [
    { value: "billing_shipping", label: "Billing phone (fallback: shipping)" },
    { value: "billing", label: "Billing phone only" },
    { value: "shipping", label: "Shipping phone only" },
    { value: "custom", label: "Custom phone number" },
]

const ORDER_DATA_PATHS = [
    { value: "order.display_id", label: "Order ID" },
    { value: "order.total", label: "Order Total" },
    { value: "order.currency_code", label: "Currency Code" },
    { value: "order.email", label: "Order Email" },
    { value: "order.shipping_address.first_name", label: "Shipping First Name" },
    { value: "order.shipping_address.last_name", label: "Shipping Last Name" },
    { value: "order.shipping_address.phone", label: "Shipping Phone" },
    { value: "order.shipping_address.city", label: "Shipping City" },
    { value: "order.billing_address.first_name", label: "Billing First Name" },
    { value: "order.billing_address.last_name", label: "Billing Last Name" },
    { value: "order.billing_address.phone", label: "Billing Phone" },
    { value: "order.customer.first_name", label: "Customer First Name" },
    { value: "order.customer.last_name", label: "Customer Last Name" },
    { value: "order.customer.email", label: "Customer Email" },
    { value: "order.customer.phone", label: "Customer Phone" },
]

type TemplateVar = { name: string; path: string }
const EMPTY_VAR: TemplateVar = { name: "", path: "" }
const MAX_VARS = 5

function MappingsSection() {
    const [mappings, setMappings] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [templateVars, setTemplateVars] = useState<TemplateVar[]>([{ ...EMPTY_VAR }])
    const [form, setForm] = useState({
        event_name: MEDUSA_EVENTS[0],
        template_name: "",
        language_code: "en_US",
        recipient_type: "billing_shipping",
        recipient_phone: "",
        active: true,
    })

    const loadMappings = useCallback(async () => {
        setLoading(true)
        const data = await api("/mappings")
        setMappings(data.mappings || [])
        setLoading(false)
    }, [])

    useEffect(() => { loadMappings() }, [loadMappings])

    const resetForm = () => {
        setForm({ event_name: MEDUSA_EVENTS[0], template_name: "", language_code: "en_US", recipient_type: "billing_shipping", recipient_phone: "", active: true })
        setTemplateVars([{ ...EMPTY_VAR }])
        setEditingId(null)
        setShowForm(false)
    }

    const updateVar = (index: number, field: keyof TemplateVar, value: string) => {
        setTemplateVars((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v))
    }
    const addVar = () => {
        if (templateVars.length < MAX_VARS) setTemplateVars((prev) => [...prev, { ...EMPTY_VAR }])
    }
    const removeVar = (index: number) => {
        setTemplateVars((prev) => prev.length <= 1 ? [{ ...EMPTY_VAR }] : prev.filter((_, i) => i !== index))
    }

    const saveMapping = async () => {
        // Convert rows to { name: path } JSON
        const variables: Record<string, string> = {}
        templateVars.forEach((v) => {
            if (v.name.trim() && v.path.trim()) variables[v.name.trim()] = v.path.trim()
        })

        const payload = { ...form, template_variables: variables }

        if (editingId) {
            await api(`/mappings/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
            toast.success("Mapping updated")
        } else {
            await api("/mappings", { method: "POST", body: JSON.stringify(payload) })
            toast.success("Mapping created")
        }

        resetForm()
        await loadMappings()
    }

    const deleteMapping = async (id: string) => {
        await api(`/mappings/${id}`, { method: "DELETE" })
        toast.success("Mapping deleted")
        await loadMappings()
    }

    const editMapping = (m: any) => {
        // Convert JSON object back to rows
        const vars = m.template_variables || {}
        const rows: TemplateVar[] = Object.entries(vars).map(([name, path]) => ({ name, path: path as string }))
        setTemplateVars(rows.length > 0 ? rows : [{ ...EMPTY_VAR }])
        setForm({
            event_name: m.event_name,
            template_name: m.template_name,
            language_code: m.language_code,
            recipient_type: m.recipient_type || "billing_shipping",
            recipient_phone: m.recipient_phone || "",
            active: m.active,
        })
        setEditingId(m.id)
        setShowForm(true)
    }

    const recipientLabel = (type: string, phone?: string) => {
        const opt = RECIPIENT_OPTIONS.find((o) => o.value === type)
        if (type === "custom" && phone) return `Custom: ${phone}`
        return opt?.label || type
    }

    return (
        <Container className="p-6">
            <div className="flex items-center justify-between mb-4">
                <Heading level="h2">Event → Template Mappings</Heading>
                <Button variant="secondary" onClick={() => { resetForm(); setShowForm(!showForm) }}>
                    {showForm ? "Cancel" : "Add Mapping"}
                </Button>
            </div>

            {showForm && (
                <div className="border rounded-lg p-4 mb-4 bg-ui-bg-subtle">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="event-name">Medusa Event</Label>
                            <Input
                                id="event-name"
                                list="medusa-events-list"
                                placeholder="Select or type a custom event..."
                                value={form.event_name}
                                onChange={(e) => setForm({ ...form, event_name: e.target.value })}
                            />
                            <datalist id="medusa-events-list">
                                {MEDUSA_EVENTS.map((e) => (
                                    <option key={e} value={e} />
                                ))}
                            </datalist>
                            <Text size="small" className="text-ui-fg-muted mt-1">
                                Pick a preset or type any custom event name
                            </Text>
                        </div>
                        <div>
                            <Label htmlFor="tpl-name">WhatsApp Template Name</Label>
                            <Input
                                id="tpl-name"
                                placeholder="e.g. order_confirmation"
                                value={form.template_name}
                                onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="tpl-lang">Language Code</Label>
                            <Input
                                id="tpl-lang"
                                placeholder="en_US"
                                value={form.language_code}
                                onChange={(e) => setForm({ ...form, language_code: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label htmlFor="recipient-type">Send To</Label>
                            <Select value={form.recipient_type} onValueChange={(val) => setForm({ ...form, recipient_type: val })}>
                                <Select.Trigger>
                                    <Select.Value placeholder="Select recipient" />
                                </Select.Trigger>
                                <Select.Content>
                                    {RECIPIENT_OPTIONS.map((opt) => (
                                        <Select.Item key={opt.value} value={opt.value}>{opt.label}</Select.Item>
                                    ))}
                                </Select.Content>
                            </Select>
                        </div>
                        {form.recipient_type === "custom" && (
                            <div>
                                <Label htmlFor="recipient-phone">Custom Phone Number</Label>
                                <Input
                                    id="recipient-phone"
                                    placeholder="e.g. 919876543210"
                                    value={form.recipient_phone}
                                    onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                                />
                                <Text size="small" className="text-ui-fg-muted mt-1">
                                    Include country code, no + prefix
                                </Text>
                            </div>
                        )}
                        <div className="flex items-end gap-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="mapping-active">Active</Label>
                                <Switch
                                    id="mapping-active"
                                    checked={form.active}
                                    onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <Label>Template Variables</Label>
                            {templateVars.length < MAX_VARS && (
                                <Button variant="secondary" size="small" onClick={addVar}>
                                    + Add Variable
                                </Button>
                            )}
                        </div>
                        <Text size="small" className="text-ui-fg-muted mb-2">
                            Map WhatsApp template variable positions (e.g. 1, 2, 3) to order data fields.
                        </Text>
                        <div className="flex flex-col gap-2">
                            {templateVars.map((v, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-24 flex-shrink-0">
                                        <Input
                                            placeholder={`${i + 1}`}
                                            value={v.name}
                                            onChange={(e) => updateVar(i, "name", e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <Input
                                            list="order-data-paths"
                                            placeholder="Select or type a data path..."
                                            value={v.path}
                                            onChange={(e) => updateVar(i, "path", e.target.value)}
                                        />
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={() => removeVar(i)}
                                    >
                                        ✕
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <datalist id="order-data-paths">
                            {ORDER_DATA_PATHS.map((p) => (
                                <option key={p.value} value={p.value} label={p.label} />
                            ))}
                        </datalist>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button onClick={saveMapping}>
                            {editingId ? "Update Mapping" : "Create Mapping"}
                        </Button>
                    </div>
                </div>
            )}

            {loading ? (
                <Text>Loading mappings...</Text>
            ) : mappings.length === 0 ? (
                <Text className="text-ui-fg-muted">No event mappings configured. Add one to get started.</Text>
            ) : (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Event</Table.HeaderCell>
                            <Table.HeaderCell>Template</Table.HeaderCell>
                            <Table.HeaderCell>Send To</Table.HeaderCell>
                            <Table.HeaderCell>Language</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {mappings.map((m: any) => (
                            <Table.Row key={m.id}>
                                <Table.Cell>
                                    <Badge color="blue">{m.event_name}</Badge>
                                </Table.Cell>
                                <Table.Cell>{m.template_name}</Table.Cell>
                                <Table.Cell>
                                    <Text size="small">{recipientLabel(m.recipient_type, m.recipient_phone)}</Text>
                                </Table.Cell>
                                <Table.Cell>{m.language_code}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={m.active ? "green" : "grey"}>
                                        {m.active ? "Active" : "Inactive"}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="secondary" size="small" onClick={() => editMapping(m)}>
                                            Edit
                                        </Button>
                                        <Button variant="danger" size="small" onClick={() => deleteMapping(m.id)}>
                                            Delete
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            )}
        </Container>
    )
}

// ─── Test Message Section ─────────────────────────────────────
function TestSection() {
    const [sending, setSending] = useState(false)
    const [form, setForm] = useState({
        phone_number: "",
        template_name: "",
        language_code: "en_US",
        template_variables: "{}",
    })

    const sendTest = async () => {
        if (!form.phone_number || !form.template_name) {
            toast.error("Phone number and template name are required")
            return
        }
        setSending(true)
        let variables = {}
        try { variables = JSON.parse(form.template_variables) } catch { /* ignore */ }

        const result = await api("/test", {
            method: "POST",
            body: JSON.stringify({ ...form, template_variables: variables }),
        })

        if (result.success) {
            toast.success("Test message sent!")
        } else {
            toast.error(`Failed: ${result.error?.error?.message || result.error || "Unknown error"}`)
        }
        setSending(false)
    }

    return (
        <Container className="p-6">
            <Heading level="h2" className="mb-4">Send Test Message</Heading>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="test-phone">Phone Number (with country code)</Label>
                    <Input
                        id="test-phone"
                        placeholder="e.g. 919876543210"
                        value={form.phone_number}
                        onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    />
                </div>
                <div>
                    <Label htmlFor="test-tpl">Template Name</Label>
                    <Input
                        id="test-tpl"
                        placeholder="e.g. hello_world"
                        value={form.template_name}
                        onChange={(e) => setForm({ ...form, template_name: e.target.value })}
                    />
                </div>
                <div>
                    <Label htmlFor="test-lang">Language Code</Label>
                    <Input
                        id="test-lang"
                        placeholder="en_US"
                        value={form.language_code}
                        onChange={(e) => setForm({ ...form, language_code: e.target.value })}
                    />
                </div>
                <div>
                    <Label htmlFor="test-vars">Template Variables (JSON)</Label>
                    <Input
                        id="test-vars"
                        placeholder='{"1": "John"}'
                        value={form.template_variables}
                        onChange={(e) => setForm({ ...form, template_variables: e.target.value })}
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <Button onClick={sendTest} isLoading={sending}>
                    Send Test Message
                </Button>
            </div>
        </Container>
    )
}

// ─── Message Logs Section ─────────────────────────────────────
function LogsSection() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const loadLogs = useCallback(async () => {
        setLoading(true)
        const data = await api("/logs?limit=20")
        setLogs(data.logs || [])
        setLoading(false)
    }, [])

    useEffect(() => { loadLogs() }, [loadLogs])

    const statusColor = (status: string) => {
        switch (status) {
            case "sent": return "green"
            case "delivered": return "green"
            case "failed": return "red"
            default: return "grey"
        }
    }

    return (
        <Container className="p-6">
            <div className="flex items-center justify-between mb-4">
                <Heading level="h2">Message Logs</Heading>
                <Button variant="secondary" size="small" onClick={loadLogs}>
                    Refresh
                </Button>
            </div>

            {loading ? (
                <Text>Loading logs...</Text>
            ) : logs.length === 0 ? (
                <Text className="text-ui-fg-muted">No messages sent yet.</Text>
            ) : (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Event</Table.HeaderCell>
                            <Table.HeaderCell>Template</Table.HeaderCell>
                            <Table.HeaderCell>Recipient</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Time</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {logs.map((log: any) => (
                            <Table.Row key={log.id}>
                                <Table.Cell>
                                    <Badge color="blue">{log.event_name}</Badge>
                                </Table.Cell>
                                <Table.Cell>{log.template_name}</Table.Cell>
                                <Table.Cell>{log.recipient_phone}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={statusColor(log.status)}>
                                        {log.status}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell>
                                    <Text size="small">
                                        {new Date(log.created_at).toLocaleString()}
                                    </Text>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            )}
        </Container>
    )
}

// ─── Main Page ─────────────────────────────────────────────────
const WhatsAppPage = () => {
    return (
        <div className="flex flex-col gap-4">
            <Toaster />
            <div className="flex items-center gap-3">
                <ChatBubbleLeftRight />
                <Heading level="h1">WhatsApp Business</Heading>
            </div>
            <ConfigSection />
            <MappingsSection />
            <TestSection />
            <LogsSection />
        </div>
    )
}

export const config = defineRouteConfig({
    label: "WhatsApp",
    icon: ChatBubbleLeftRight,
})

export default WhatsAppPage
