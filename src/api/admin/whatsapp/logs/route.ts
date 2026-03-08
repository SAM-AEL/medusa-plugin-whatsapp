import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)

    const filters: any = {}
    if (req.query.q) {
        filters.recipient_phone = { $like: `%${req.query.q}%` }
    }

    const [logs, count] = await (whatsappModule as any).listAndCountWhatsappMessageLogs(
        filters,
        {
            take: Number(req.query.limit) || 20,
            skip: Number(req.query.offset) || 0,
            order: { created_at: "DESC" },
        }
    )

    res.json({ logs, count })
}
