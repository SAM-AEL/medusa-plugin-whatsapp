import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)

    // Get config for credentials
    const [configs] = await (whatsappModule as any).listAndCountWhatsappConfigs(
        {},
        { take: 1 }
    )

    const config = configs?.[0]
    const accessToken = config?.access_token || process.env.WHATSAPP_ACCESS_TOKEN
    const apiVersion = config?.api_version || process.env.WHATSAPP_API_VERSION || "v25.0"
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

    if (!accessToken || !wabaId) {
        return res.json({
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
            return res.status(400).json({
                templates: [],
                error: data?.error?.message || "Failed to fetch templates",
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

        res.json({ templates })
    } catch (error: any) {
        res.status(500).json({
            templates: [],
            error: error.message,
        })
    }
}
