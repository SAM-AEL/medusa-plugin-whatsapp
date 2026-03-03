import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const WHATSAPP_MODULE = "whatsapp"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)

    const [configs] = await (whatsappModule as any).listAndCountWhatsappConfigs(
        {},
        { take: 1 }
    )

    if (configs.length === 0) {
        // Return env-based status so admin UI can show whether env vars are set
        return res.json({
            config: null,
            env_configured: !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
        })
    }

    // Mask the access token for security
    const config = { ...configs[0] }
    if (config.access_token) {
        config.access_token =
            config.access_token.substring(0, 8) + "..." + config.access_token.slice(-4)
    }

    res.json({ config })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const whatsappModule = req.scope.resolve(WHATSAPP_MODULE)
    const body = req.body as Record<string, any>

    const { phone_number_id, access_token, api_version, default_language_code, active } = body

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
        if (access_token !== undefined && access_token !== "") updateData.access_token = access_token
        if (api_version !== undefined) updateData.api_version = api_version
        if (default_language_code !== undefined) updateData.default_language_code = default_language_code
        if (active !== undefined) updateData.active = active

        config = await (whatsappModule as any).updateWhatsappConfigs(existing[0].id, updateData)
    } else {
        // Create new config
        config = await (whatsappModule as any).createWhatsappConfigs({
            phone_number_id: phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "",
            access_token: access_token || process.env.WHATSAPP_ACCESS_TOKEN || "",
            api_version: api_version || process.env.WHATSAPP_API_VERSION || "v25.0",
            default_language_code: default_language_code || "en_US",
            active: active !== undefined ? active : true,
        })
    }

    // Mask token in response
    const responseConfig = { ...config }
    if (responseConfig.access_token) {
        responseConfig.access_token =
            responseConfig.access_token.substring(0, 8) + "..." + responseConfig.access_token.slice(-4)
    }

    res.json({ config: responseConfig })
}
