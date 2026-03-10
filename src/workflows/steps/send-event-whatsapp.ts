import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
    createWhatsappMessageLog,
    fetchEntityData,
    getWhatsappConfig,
    resolveDataPath,
    resolvePhoneNumber,
    sendWhatsappTemplateMessage,
} from "../../shared/whatsapp-runtime"

const WHATSAPP_MODULE = "whatsapp"

export type SendEventWhatsappStepInput = {
    event_name: string
    event_data: Record<string, any>
}

type SendEventWhatsappStepOutput = {
    sent: number
    failed: number
    skipped: number
}

export const sendEventWhatsappStep = createStep<
    SendEventWhatsappStepInput,
    SendEventWhatsappStepOutput,
    void
>(
    "send-event-whatsapp",
    async (input: SendEventWhatsappStepInput, { container }) => {
        const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
        const whatsappModule = container.resolve(WHATSAPP_MODULE)
        const whatsappConfig = await getWhatsappConfig(whatsappModule)

        if (!whatsappConfig.configured) {
            logger.warn(`[WhatsApp] Not configured, skipping event ${input.event_name}`)
            return new StepResponse({ sent: 0, failed: 0, skipped: 0 }, undefined)
        }

        const [mappings] = await (whatsappModule as any).listAndCountWhatsappEventMappings(
            { event_name: input.event_name, active: true }
        )

        if (!mappings?.length) {
            return new StepResponse({ sent: 0, failed: 0, skipped: 0 }, undefined)
        }

        const enrichedData = await fetchEntityData(
            input.event_data,
            input.event_name,
            container,
            logger
        )

        let sent = 0
        let failed = 0
        let skipped = 0

        for (const mapping of mappings) {
            const recipientPhone = await resolvePhoneNumber(
                input.event_data,
                input.event_name,
                container,
                mapping.recipient_type || "billing_shipping",
                mapping.recipient_phone
            )

            if (!recipientPhone) {
                skipped += 1
                logger.warn(
                    `[WhatsApp] No phone number found for event ${input.event_name} (recipient_type: ${mapping.recipient_type})`
                )
                continue
            }

            let templateVars: Record<string, string> = {}
            if (mapping.template_variables) {
                if (typeof mapping.template_variables === "string") {
                    try {
                        templateVars = JSON.parse(mapping.template_variables)
                    } catch {
                        templateVars = {}
                    }
                } else {
                    templateVars = mapping.template_variables
                }
            }

            const bodyParameters = Object.entries(templateVars).map(
                ([_key, path]: [string, any]) => ({
                    type: "text" as const,
                    text: String(resolveDataPath(enrichedData, path as string) ?? ""),
                })
            )

            let requestPayload: Record<string, any> = {}
            let responsePayload: Record<string, any> = {}

            try {
                const result = await sendWhatsappTemplateMessage({
                    phoneNumberId: whatsappConfig.phoneNumberId!,
                    accessToken: whatsappConfig.accessToken!,
                    apiVersion: whatsappConfig.apiVersion,
                    recipientPhone,
                    templateName: mapping.template_name,
                    languageCode: mapping.language_code || whatsappConfig.defaultLanguageCode,
                    bodyParameters,
                })

                requestPayload = result.requestPayload
                responsePayload = result.responseData

                if (process.env.NODE_ENV === "development") {
                    console.log(`[WhatsApp Dev] Sending "${input.event_name}" event message to:`, result.url)
                    console.log("[WhatsApp Dev] Enriched data:", JSON.stringify(enrichedData, null, 2))
                    console.log("[WhatsApp Dev] Request payload:", JSON.stringify(result.requestPayload, null, 2))
                }

                await createWhatsappMessageLog(container, {
                    event_name: input.event_name,
                    recipient_phone: recipientPhone,
                    template_name: mapping.template_name,
                    status: result.response.ok ? "sent" : "failed",
                    wa_message_id: result.responseData?.messages?.[0]?.id || null,
                    error_message: result.response.ok ? null : JSON.stringify(result.responseData?.error || result.responseData),
                    request_payload: result.requestPayload,
                    response_payload: result.responseData,
                })

                if (result.response.ok) {
                    sent += 1
                    logger.info(
                        `[WhatsApp] Sent "${mapping.template_name}" to ${recipientPhone} for event ${input.event_name}`
                    )
                } else {
                    failed += 1
                    logger.error(
                        `[WhatsApp] Failed to send "${mapping.template_name}": ${JSON.stringify(result.responseData)}`
                    )
                    throw new Error(
                        result.responseData?.error?.message || "WhatsApp Cloud API request failed"
                    )
                }
            } catch (err: any) {
                failed += 1
                logger.error(`[WhatsApp] Error sending message: ${err.message}`)
                await createWhatsappMessageLog(container, {
                    event_name: input.event_name,
                    recipient_phone: recipientPhone,
                    template_name: mapping.template_name,
                    status: "failed",
                    error_message: err.message,
                    request_payload: requestPayload,
                    response_payload: responsePayload,
                })
                throw err
            }
        }

        return new StepResponse({ sent, failed, skipped }, undefined)
    }
)
