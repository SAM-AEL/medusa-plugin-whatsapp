import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { id } = req.params
    const body = req.body as Record<string, any>

    const updateData: Record<string, any> = {}
    if (body.event_name !== undefined) updateData.event_name = body.event_name
    if (body.template_name !== undefined) updateData.template_name = body.template_name
    if (body.language_code !== undefined) updateData.language_code = body.language_code
    if (body.template_variables !== undefined) updateData.template_variables = body.template_variables
    if (body.recipient_type !== undefined) updateData.recipient_type = body.recipient_type
    if (body.recipient_type !== undefined) updateData.recipient_phone = body.recipient_type === "custom" ? body.recipient_phone : null
    if (body.active !== undefined) updateData.active = body.active

    const mapping = await (whatsappModule as any).updateWhatsappEventMappings(id, updateData)

    res.json({ mapping })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { id } = req.params

    await (whatsappModule as any).deleteWhatsappEventMappings(id)

    res.json({ id, deleted: true })
}
