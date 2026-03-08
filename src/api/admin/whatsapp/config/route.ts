import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)

    const [configs] = await (whatsappModule as any).listAndCountWhatsappConfigs(
        {},
        { take: 1 }
    )

    const envHints = {
        env_phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
        env_configured: !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
    }

    if (configs.length === 0) {
        return res.json({
            config: null,
            ...envHints,
        })
    }

    // Strip access_token from response — it should only be in env vars
    const { access_token, ...config } = configs[0]

    res.json({ config, ...envHints })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const body = req.body as Record<string, any>

    const { phone_number_id, api_version, default_language_code, active } = body

    // Check if a config already exists
    const [existing] = await (whatsappModule as any).listAndCountWhatsappConfigs(
        {},
        { take: 1 }
    )

    let config
    if (existing.length > 0) {
        // Update existing config
        const updateData: Record<string, any> = {}
        if (phone_number_id !== undefined) updateData.phone_number_id = phone_number_id

        if (api_version !== undefined) updateData.api_version = api_version
        if (default_language_code !== undefined) updateData.default_language_code = default_language_code
        if (active !== undefined) updateData.active = active

        config = await (whatsappModule as any).updateWhatsappConfigs(existing[0].id, updateData)
    } else {
        // Create new config
        config = await (whatsappModule as any).createWhatsappConfigs({
            phone_number_id: phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
            access_token: process.env.WHATSAPP_ACCESS_TOKEN || "",
            api_version: api_version || process.env.WHATSAPP_API_VERSION || "v25.0",
            default_language_code: default_language_code || "en_US",
            active: active !== undefined ? active : true,
        })
    }

    // Strip access_token from response
    const { access_token: _token, ...responseConfig } = config

    res.json({ config: responseConfig })
}
