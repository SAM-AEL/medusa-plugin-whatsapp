import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
    fail,
    isLikelyPhone,
    normalizeTemplateVariables,
    ok,
    setDeprecatedPutHeaders,
} from "../../../../../shared/http"

const WHATSAPP_MODULE = "whatsapp"

async function updateMapping(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { id } = req.params
    const body = req.body as Record<string, any>

    if (!id) {
        return fail(res, 400, "INVALID_PAYLOAD", "id parameter is required")
    }

    // Retrieve the existing mapping to merge with updates
    const [mappings] = await (whatsappModule as any).listAndCountWhatsappEventMappings(
        { id },
        { take: 1 }
    )
    const existing = mappings?.[0]
    if (!existing) {
        return fail(res, 404, "NOT_FOUND", "Mapping not found")
    }

    // Merge existing data with incoming updates
    const mergedData: Record<string, any> = {
        event_name: body.event_name ?? existing.event_name,
        template_name: body.template_name ?? existing.template_name,
        language_code: body.language_code ?? existing.language_code,
        template_variables: normalizeTemplateVariables(
            body.template_variables ?? existing.template_variables ?? {}
        ),
        recipient_type: body.recipient_type ?? existing.recipient_type ?? "billing_shipping",
        recipient_phone: (body.recipient_type ?? existing.recipient_type) === "custom"
            ? (body.recipient_phone ?? existing.recipient_phone)
            : null,
        active: body.active ?? existing.active,
    }

    if (mergedData.recipient_type === "custom" && !isLikelyPhone(mergedData.recipient_phone)) {
        return fail(res, 400, "INVALID_RECIPIENT", "recipient_phone must be valid for custom recipient_type")
    }

    const updated = await (whatsappModule as any).updateWhatsappEventMappings([
        { id, ...mergedData },
    ])
    const mapping = Array.isArray(updated) ? updated[0] : updated

    return ok(res, { mapping })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    return updateMapping(req, res)
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
    setDeprecatedPutHeaders(res, "POST", "/admin/whatsapp/mappings/:id")
    return updateMapping(req, res)
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const { id } = req.params

    if (!id) {
        return fail(res, 400, "INVALID_PAYLOAD", "id parameter is required")
    }

    await (whatsappModule as any).deleteWhatsappEventMappings(id)

    return ok(res, { id, deleted: true })
}
