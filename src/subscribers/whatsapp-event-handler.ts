import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const WHATSAPP_MODULE = "whatsapp"

// Fields to fetch per entity type via query.graph
const ORDER_FIELDS = [
    "id", "display_id", "status", "total", "subtotal", "currency_code", "email",
    "shipping_address.first_name", "shipping_address.last_name",
    "shipping_address.phone", "shipping_address.city",
    "billing_address.first_name", "billing_address.last_name", "billing_address.phone",
    "customer.first_name", "customer.last_name", "customer.email", "customer.phone",
]

const CUSTOMER_FIELDS = ["id", "email", "first_name", "last_name", "phone"]

const FULFILLMENT_FIELDS = ["id", "tracking_numbers", "provider_id"]

const RETURN_FIELDS = ["id", "status", "order_id"]

export default async function whatsappEventHandler({
    event: { name, data },
    container,
}: SubscriberArgs<Record<string, any>>) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const whatsappModule = container.resolve(WHATSAPP_MODULE)

    try {
        // Get active WhatsApp config from DB
        const [configs] = await (whatsappModule as any).listAndCountWhatsappConfigs(
            { active: true },
            { take: 1 }
        )

        const config = configs?.[0]

        // Resolve credentials: DB config takes priority, then env vars
        const phoneNumberId = config?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID
        const accessToken = config?.access_token || process.env.WHATSAPP_ACCESS_TOKEN
        const apiVersion = config?.api_version || process.env.WHATSAPP_API_VERSION || "v25.0"
        const defaultLangCode = config?.default_language_code || "en_US"

        if (!phoneNumberId || !accessToken) {
            return // WhatsApp not configured, silently skip
        }

        // Find mappings for this event
        const [mappings] = await (whatsappModule as any).listAndCountWhatsappEventMappings(
            { event_name: name, active: true }
        )

        if (!mappings || mappings.length === 0) return

        // Fetch full entity data for template variable resolution
        const enrichedData = await fetchEntityData(data, name, container, logger)

        for (const mapping of mappings) {
            // Resolve phone based on mapping's recipient_type
            const recipientPhone = await resolvePhoneNumber(
                data,
                name,
                container,
                mapping.recipient_type || "billing_shipping",
                mapping.recipient_phone
            )

            if (!recipientPhone) {
                logger.warn(`[WhatsApp] No phone number found for event ${name} (recipient_type: ${mapping.recipient_type})`)
                continue
            }

            // Parse template_variables (handle both string and object)
            let templateVars: Record<string, string> = {}
            if (mapping.template_variables) {
                if (typeof mapping.template_variables === "string") {
                    try { templateVars = JSON.parse(mapping.template_variables) } catch { /* ignore */ }
                } else {
                    templateVars = mapping.template_variables
                }
            }

            // Build template variables
            const components: any[] = []
            if (Object.keys(templateVars).length > 0) {
                const bodyParams = Object.entries(templateVars).map(
                    ([_key, path]: [string, any]) => ({
                        type: "text" as const,
                        text: String(resolveDataPath(enrichedData, path as string) || path),
                    })
                )
                if (bodyParams.length > 0) {
                    components.push({ type: "body", parameters: bodyParams })
                }
            }

            const requestPayload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: recipientPhone,
                type: "template",
                template: {
                    name: mapping.template_name,
                    language: {
                        code: mapping.language_code || defaultLangCode,
                    },
                    ...(components.length > 0 ? { components } : {}),
                },
            }

            try {
                const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`
                
                if (process.env.NODE_ENV === "development") {
                    console.log(`[WhatsApp Dev] Sending "${name}" event message to:`, url)
                    console.log("[WhatsApp Dev] Enriched data:", JSON.stringify(enrichedData, null, 2))
                    console.log("[WhatsApp Dev] Request payload:", JSON.stringify(requestPayload, null, 2))
                }

                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestPayload),
                })

                const responseData = await response.json()

                await (whatsappModule as any).createWhatsappMessageLogs({
                    event_name: name,
                    recipient_phone: recipientPhone,
                    template_name: mapping.template_name,
                    status: response.ok ? "sent" : "failed",
                    wa_message_id: responseData?.messages?.[0]?.id || null,
                    error_message: response.ok ? null : JSON.stringify(responseData?.error || responseData),
                    request_payload: requestPayload,
                    response_payload: responseData,
                })

                if (response.ok) {
                    logger.info(
                        `[WhatsApp] Sent "${mapping.template_name}" to ${recipientPhone} for event ${name}`
                    )
                } else {
                    logger.error(
                        `[WhatsApp] Failed to send "${mapping.template_name}": ${JSON.stringify(responseData)}`
                    )
                }
            } catch (err: any) {
                logger.error(`[WhatsApp] Error sending message: ${err.message}`)
                await (whatsappModule as any).createWhatsappMessageLogs({
                    event_name: name,
                    recipient_phone: recipientPhone,
                    template_name: mapping.template_name,
                    status: "failed",
                    error_message: err.message,
                    request_payload: requestPayload,
                    response_payload: {},
                })
            }
        }
    } catch (error: any) {
        logger.error(`[WhatsApp] Subscriber error: ${error.message}`)
    }
}

/**
 * Resolve a dot-path from nested data.
 * E.g., resolveDataPath(data, "shipping_address.first_name") => data.shipping_address.first_name
 */
function resolveDataPath(data: any, path: string): any {
    return path.split(".").reduce((obj, key) => obj?.[key], data)
}

/**
 * Fetch full entity data from Medusa using query.graph.
 * Events typically pass minimal data ({ id }), so we enrich it with actual entity fields.
 * Falls back to raw event data if fetching fails.
 */
async function fetchEntityData(
    data: any,
    eventName: string,
    container: any,
    logger: any,
): Promise<Record<string, any>> {
    try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)

        if (eventName.startsWith("order.")) {
            const { data: orders } = await query.graph({
                entity: "order",
                fields: ORDER_FIELDS,
                filters: { id: data.id },
            })
            return orders?.[0] || data
        }

        if (eventName.startsWith("fulfillment.")) {
            // Fetch fulfillment data
            const { data: fulfillments } = await query.graph({
                entity: "fulfillment",
                fields: FULFILLMENT_FIELDS,
                filters: { id: data.id },
            })
            const fulfillment = fulfillments?.[0] || {}

            // Also fetch parent order if order_id is available
            const orderId = data.order_id || fulfillment.order_id
            if (orderId) {
                const { data: orders } = await query.graph({
                    entity: "order",
                    fields: ORDER_FIELDS,
                    filters: { id: orderId },
                })
                return { ...fulfillment, order: orders?.[0] || {} }
            }

            return { ...data, ...fulfillment }
        }

        if (eventName.startsWith("customer.")) {
            const { data: customers } = await query.graph({
                entity: "customer",
                fields: CUSTOMER_FIELDS,
                filters: { id: data.id },
            })
            return customers?.[0] || data
        }

        if (eventName.startsWith("return.")) {
            const { data: returns } = await query.graph({
                entity: "return",
                fields: RETURN_FIELDS,
                filters: { id: data.id },
            })
            const ret = returns?.[0] || {}

            // Also fetch parent order
            const orderId = data.order_id || ret.order_id
            if (orderId) {
                const { data: orders } = await query.graph({
                    entity: "order",
                    fields: ORDER_FIELDS,
                    filters: { id: orderId },
                })
                return { ...ret, order: orders?.[0] || {} }
            }

            return { ...data, ...ret }
        }

        if (eventName.startsWith("claim.") || eventName.startsWith("exchange.")) {
            // Claims/exchanges share a similar pattern — fetch with parent order
            const entity = eventName.startsWith("claim.") ? "claim" : "exchange"
            try {
                const { data: items } = await query.graph({
                    entity,
                    fields: ["id", "type", "order_id"],
                    filters: { id: data.id },
                })
                const item = items?.[0] || {}

                const orderId = data.order_id || item.order_id
                if (orderId) {
                    const { data: orders } = await query.graph({
                        entity: "order",
                        fields: ORDER_FIELDS,
                        filters: { id: orderId },
                    })
                    return { ...item, order: orders?.[0] || {} }
                }

                return { ...data, ...item }
            } catch {
                return data
            }
        }

        return data
    } catch (err: any) {
        logger.warn(`[WhatsApp] Could not fetch entity data for ${eventName}: ${err.message}`)
        return data // fall back to raw event data
    }
}

/**
 * Resolve the customer phone number based on recipient_type.
 * - "billing": order billing address phone
 * - "shipping": order shipping address phone
 * - "billing_shipping": billing first, fallback to shipping
 * - "custom": use the provided recipient_phone directly
 */
async function resolvePhoneNumber(
    data: any,
    eventName: string,
    container: any,
    recipientType: string,
    recipientPhone?: string | null
): Promise<string | null> {
    // Custom number — use it directly
    if (recipientType === "custom") {
        return recipientPhone || null
    }

    // Direct phone field on event data (customer-level events)
    if (!eventName.startsWith("order.") && !eventName.startsWith("fulfillment.")) {
        if (data.phone) return data.phone
        if (data.customer?.phone) return data.customer.phone
        return null
    }

    // For order / fulfillment events — fetch addresses from the order
    const orderId = eventName.startsWith("order.") ? data.id : data.order_id
    if (!orderId) return null

    try {
        const query = container.resolve(ContainerRegistrationKeys.QUERY)
        const { data: orders } = await query.graph({
            entity: "order",
            fields: [
                "id",
                "billing_address.phone",
                "shipping_address.phone",
                "customer.phone",
            ],
            filters: { id: orderId },
        })

        const order = orders?.[0]
        if (!order) return null

        const billingPhone = order.billing_address?.phone
        const shippingPhone = order.shipping_address?.phone
        const customerPhone = order.customer?.phone

        switch (recipientType) {
            case "billing":
                return billingPhone || customerPhone || null
            case "shipping":
                return shippingPhone || customerPhone || null
            case "billing_shipping":
            default:
                return billingPhone || shippingPhone || customerPhone || null
        }
    } catch {
        return null
    }
}

export const config: SubscriberConfig = {
    event: [
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
    ],
}
