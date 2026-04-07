import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ok, parsePagination } from "../../../../shared/http"
import { redactSensitiveObject } from "../../../../shared/log-policy"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>, 20)

    const filters: any = {}
    if (req.query.q) {
        filters.recipient_phone = { $like: `%${req.query.q}%` }
    }

    const [logs, count] = await (whatsappModule as any).listAndCountWhatsappMessageLogs(
        filters,
        {
            take: limit,
            skip: offset,
            order: { created_at: "DESC" },
        }
    )

    const sanitizedLogs = (logs || []).map((entry: Record<string, unknown>) => ({
        ...entry,
        request_payload: redactSensitiveObject(entry.request_payload),
        response_payload: redactSensitiveObject(entry.response_payload),
    }))

    return ok(res, { logs: sanitizedLogs, count })
}
