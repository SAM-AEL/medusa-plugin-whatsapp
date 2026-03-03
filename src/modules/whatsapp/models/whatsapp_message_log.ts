import { model } from "@medusajs/framework/utils"

const WhatsappMessageLog = model.define("whatsapp_message_log", {
    id: model.id().primaryKey(),
    event_name: model.text(),
    recipient_phone: model.text(),
    template_name: model.text(),
    status: model.enum(["pending", "sent", "failed", "delivered"]).default("pending"),
    wa_message_id: model.text().nullable(),
    error_message: model.text().nullable(),
    request_payload: model.json().default({}),
    response_payload: model.json().default({}),
})

export default WhatsappMessageLog
