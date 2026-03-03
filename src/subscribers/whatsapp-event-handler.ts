import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const WHATSAPP_MODULE = "whatsapp"

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

            // Build template variables
            const components: any[] = []
            if (mapping.template_variables && Object.keys(mapping.template_variables).length > 0) {
                const bodyParams = Object.entries(mapping.template_variables).map(
                    ([_key, path]: [string, any]) => ({
                        type: "text" as const,
                        text: String(resolveDataPath(data, path as string) || path),
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
 * E.g., resolveDataPath(data, "order.customer.phone") => data.order.customer.phone
 */
function resolveDataPath(data: any, path: string): any {
    return path.split(".").reduce((obj, key) => obj?.[key], data)
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
