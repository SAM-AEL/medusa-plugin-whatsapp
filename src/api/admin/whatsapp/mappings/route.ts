import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)

    const [mappings, count] = await (whatsappModule as any).listAndCountWhatsappEventMappings(
        {},
        {
            take: Number(req.query.limit) || 50,
            skip: Number(req.query.offset) || 0,
            order: { created_at: "DESC" },
        }
    )

    res.json({ mappings, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const body = req.body as Record<string, any>

    const { event_name, template_name, language_code, template_variables, active, recipient_type, recipient_phone } = body

    if (!event_name || !template_name) {
        return res.status(400).json({ message: "event_name and template_name are required" })
    }

    const mapping = await (whatsappModule as any).createWhatsappEventMappings({
        event_name,
        template_name,
        language_code: language_code || "en_US",
        template_variables: template_variables || {},
        recipient_type: recipient_type || "billing_shipping",
        recipient_phone: recipient_type === "custom" ? recipient_phone : null,
        active: active !== undefined ? active : true,
    })

    res.status(201).json({ mapping })
}
