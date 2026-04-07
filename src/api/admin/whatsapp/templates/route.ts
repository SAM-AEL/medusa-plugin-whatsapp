import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getWhatsappConfig } from "../../../../shared/whatsapp-runtime"
import { fail, ok } from "../../../../shared/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)

    // Get config for credentials
    const [configs] = await (whatsappModule as any).listAndCountWhatsappConfigs(
        {},
        { take: 1 }
    )

    const whatsappConfig = await getWhatsappConfig(whatsappModule)
    const accessToken = whatsappConfig.accessToken
    const apiVersion = whatsappConfig.apiVersion
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

    if (!accessToken || !wabaId) {
        return ok(res, {
            templates: [],
            message: !wabaId
                ? "Set WHATSAPP_BUSINESS_ACCOUNT_ID env var to fetch templates."
                : "WhatsApp access token not configured.",
        })
    }

    try {
        const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?limit=100&status=APPROVED`

        if (process.env.NODE_ENV === "development") {
            console.log("[WhatsApp Dev] Fetching templates from:", url)
        }

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        const data = await response.json()

        if (!response.ok) {
            return fail(res, 400, "TEMPLATE_FETCH_FAILED", data?.error?.message || "Failed to fetch templates", {
                templates: [],
            })
        }

        // Return simplified template list
        const templates = (data.data || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            language: t.language,
            status: t.status,
            category: t.category,
            components: t.components,
        }))

        return ok(res, { templates })
    } catch (error: any) {
        return fail(res, 500, "TEMPLATE_FETCH_FAILED", error.message, { templates: [] })
    }
}
