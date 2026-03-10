import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
    createWhatsappMessageLog,
    getWhatsappConfig,
    sendWhatsappTemplateMessage,
} from "../../../../shared/whatsapp-runtime"

const WHATSAPP_MODULE = "whatsapp"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    const body = req.body as Record<string, any>

    const { phone_number, template_name, language_code, template_variables } = body

    if (!phone_number || !template_name) {
        return res.status(400).json({ message: "phone_number and template_name are required" })
    }

    const whatsappConfig = await getWhatsappConfig(whatsappModule)
    const config = whatsappConfig.config

    if (!whatsappConfig.configured) {
        return res.status(400).json({
            message: "WhatsApp is not configured. Set phone_number_id and access_token in config or env vars (WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN).",
        })
    }

    const bodyParams = template_variables && Object.keys(template_variables).length > 0
        ? Object.values(template_variables).map((value: any) => ({
            type: "text" as const,
            text: String(value),
        }))
        : []

    let requestPayload: Record<string, any> = {}

    try {
        const { url, requestPayload: payload, response, responseData } =
            await sendWhatsappTemplateMessage({
                phoneNumberId: whatsappConfig.phoneNumberId!,
                accessToken: whatsappConfig.accessToken!,
                apiVersion: whatsappConfig.apiVersion,
                recipientPhone: phone_number,
                templateName: template_name,
                languageCode: language_code || config?.default_language_code || "en_US",
                bodyParameters: bodyParams,
            })
        requestPayload = payload

        if (process.env.NODE_ENV === "development") {
            console.log("[WhatsApp Dev] Sending test message to:", url)
            console.log("[WhatsApp Dev] Request payload:", JSON.stringify(requestPayload, null, 2))
        }

        // Log the message
        const messageLog = await createWhatsappMessageLog(req.scope, {
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

        await createWhatsappMessageLog(req.scope, {
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
