import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
    fail,
    isLikelyPhone,
    normalizeTemplateVariables,
    ok,
    parsePagination,
} from "../../../../shared/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>)

    const [mappings, count] = await (whatsappModule as any).listAndCountWhatsappEventMappings(
        {},
        {
            take: limit,
            skip: offset,
            order: { created_at: "DESC" },
        }
    )

    return ok(res, { mappings, count })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const body = req.body as Record<string, any>

    const { event_name, template_name, language_code, template_variables, active, recipient_type, recipient_phone } = body

    if (!event_name || !template_name) {
        return fail(res, 400, "INVALID_PAYLOAD", "event_name and template_name are required")
    }

    if (recipient_type === "custom" && !isLikelyPhone(recipient_phone)) {
        return fail(res, 400, "INVALID_RECIPIENT", "recipient_phone is required and must be valid when recipient_type is custom")
    }

    const mapping = await (whatsappModule as any).createWhatsappEventMappings({
        event_name,
        template_name,
        language_code: language_code || "en_US",
        template_variables: normalizeTemplateVariables(template_variables),
        recipient_type: recipient_type || "billing_shipping",
        recipient_phone: recipient_type === "custom" ? recipient_phone : null,
        active: active !== undefined ? active : true,
    })

    return ok(res, { mapping }, 201)
}
