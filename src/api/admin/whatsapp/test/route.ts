import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const WHATSAPP_MODULE = "whatsapp"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    const body = req.body as Record<string, any>

    const { phone_number, template_name, language_code, template_variables } = body

    if (!phone_number || !template_name) {
        return res.status(400).json({ message: "phone_number and template_name are required" })
    }

    // Get the WhatsApp config
    const [configs] = await (whatsappModule as any).listAndCountWhatsappConfigs(
        {},
        { take: 1 }
    )

    const config = configs?.[0]

    // Resolve credentials: DB config → env vars
    const phoneNumberId = config?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = config?.access_token || process.env.WHATSAPP_ACCESS_TOKEN
    const apiVersion = config?.api_version || process.env.WHATSAPP_API_VERSION || "v25.0"

    if (!phoneNumberId || !accessToken) {
        return res.status(400).json({
            message: "WhatsApp is not configured. Set phone_number_id and access_token in config or env vars (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN).",
        })
    }

    // Build the request payload
    const components: any[] = []
    if (template_variables && Object.keys(template_variables).length > 0) {
        const bodyParams = Object.values(template_variables).map((value: any) => ({
            type: "text",
            text: String(value),
        }))
        components.push({
            type: "body",
            parameters: bodyParams,
        })
    }

    const requestPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone_number,
        type: "template",
        template: {
            name: template_name,
            language: {
                code: language_code || config?.default_language_code || "en_US",
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

        // Log the message
        const messageLog = await (whatsappModule as any).createWhatsappMessageLogs({
            event_name: "test_message",
            recipient_phone: phone_number,
            template_name,
            status: response.ok ? "sent" : "failed",
            wa_message_id: responseData?.messages?.[0]?.id || null,
            error_message: response.ok ? null : JSON.stringify(responseData?.error || responseData),
            request_payload: requestPayload,
            response_payload: responseData,
        })

        if (response.ok) {
            logger.info(`[WhatsApp] Test message sent to ${phone_number} using template ${template_name}`)
            res.json({ success: true, log: messageLog, response: responseData })
        } else {
            logger.error(`[WhatsApp] Test message failed: ${JSON.stringify(responseData)}`)
            res.status(400).json({ success: false, log: messageLog, error: responseData })
        }
    } catch (error: any) {
        logger.error(`[WhatsApp] Test message error: ${error.message}`)

        await (whatsappModule as any).createWhatsappMessageLogs({
            event_name: "test_message",
            recipient_phone: phone_number,
            template_name,
            status: "failed",
            error_message: error.message,
            request_payload: requestPayload,
            response_payload: {},
        })

        res.status(500).json({ success: false, error: error.message })
    }
}
