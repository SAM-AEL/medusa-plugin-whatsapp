import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
    createWhatsappMessageLog,
    getWhatsappConfig,
    sendWhatsappTemplateMessage,
} from "../../../../shared/whatsapp-runtime"
import { fail, isLikelyPhone, normalizeTemplateVariables, ok } from "../../../../shared/http"
import { redactSensitiveObject } from "../../../../shared/log-policy"

const WHATSAPP_MODULE = "whatsapp"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    const body = req.body as Record<string, any>

    const { phone_number, template_name, language_code, template_variables } = body

    if (!phone_number || !template_name) {
        return fail(res, 400, "INVALID_PAYLOAD", "phone_number and template_name are required")
    }

    if (!isLikelyPhone(phone_number)) {
        return fail(res, 400, "INVALID_RECIPIENT", "phone_number must be a valid international phone number")
    }

    const whatsappConfig = await getWhatsappConfig(whatsappModule)
    const config = whatsappConfig.config

    if (!whatsappConfig.configured) {
        return fail(
            res,
            400,
            "WHATSAPP_NOT_CONFIGURED",
            "WhatsApp is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN."
        )
    }

    const normalizedVars = normalizeTemplateVariables(template_variables)
    const bodyParams = Object.keys(normalizedVars).length > 0
        ? Object.values(normalizedVars).map((value: any) => ({
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
            error_message: response.ok ? null : JSON.stringify(redactSensitiveObject(responseData?.error || responseData)),
            request_payload: redactSensitiveObject(requestPayload),
            response_payload: redactSensitiveObject(responseData),
        })

        if (response.ok) {
            logger.info(`[WhatsApp] Test message sent to ${phone_number} using template ${template_name}`)
            return ok(res, { log: messageLog, response: redactSensitiveObject(responseData) })
        } else {
            logger.error(`[WhatsApp] Test message failed`)
            return fail(res, 400, "SEND_FAILED", "WhatsApp test message failed", {
                log: messageLog,
                error: redactSensitiveObject(responseData),
            })
        }
    } catch (error: any) {
        logger.error(`[WhatsApp] Test message error: ${error.message}`)

        await createWhatsappMessageLog(req.scope, {
            event_name: "test_message",
            recipient_phone: phone_number,
            template_name,
            status: "failed",
            error_message: error.message,
            request_payload: redactSensitiveObject(requestPayload),
            response_payload: {},
        })

        return fail(res, 500, "SEND_FAILED", error.message)
    }
}
