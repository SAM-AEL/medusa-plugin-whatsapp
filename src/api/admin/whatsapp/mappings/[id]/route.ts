import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { id } = req.params
    const body = req.body as Record<string, any>

    // Retrieve the existing mapping to merge with updates
    const [mappings] = await (whatsappModule as any).listAndCountWhatsappEventMappings(
        { id },
        { take: 1 }
    )
    const existing = mappings?.[0]
    if (!existing) {
        return res.status(404).json({ message: "Mapping not found" })
    }

    // Merge existing data with incoming updates
    const mergedData: Record<string, any> = {
        event_name: body.event_name ?? existing.event_name,
        template_name: body.template_name ?? existing.template_name,
        language_code: body.language_code ?? existing.language_code,
        template_variables: body.template_variables ?? existing.template_variables ?? {},
        recipient_type: body.recipient_type ?? existing.recipient_type ?? "billing_shipping",
        recipient_phone: (body.recipient_type ?? existing.recipient_type) === "custom"
            ? (body.recipient_phone ?? existing.recipient_phone)
            : null,
        active: body.active ?? existing.active,
    }

    // Workaround: MedusaJS v2 update() crashes on JSON columns with object values.
    // Delete + recreate instead.
    await (whatsappModule as any).deleteWhatsappEventMappings(id)
    const mapping = await (whatsappModule as any).createWhatsappEventMappings(mergedData)

    res.json({ mapping })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { id } = req.params

    await (whatsappModule as any).deleteWhatsappEventMappings(id)

    res.json({ id, deleted: true })
}
