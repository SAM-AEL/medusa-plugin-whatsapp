import type { MedusaContainer } from "@medusajs/framework/types"

const WHATSAPP_MODULE = "whatsapp"

export default async function cleanupWhatsappLogsJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const whatsappModule = container.resolve(WHATSAPP_MODULE)
  const retentionDays = Math.max(1, Number(process.env.WHATSAPP_LOG_RETENTION_DAYS || 30))
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  try {
    const [logs] = await (whatsappModule as any).listAndCountWhatsappMessageLogs(
      { created_at: { $lt: cutoff } },
      { take: 500, order: { created_at: "ASC" } }
    )

    if (!logs?.length) {
      return
    }

    await (whatsappModule as any).deleteWhatsappMessageLogs(logs.map((entry: { id: string }) => entry.id))
    logger.info(`[WhatsApp] Cleanup job deleted ${logs.length} log records older than ${retentionDays} days`)
  } catch (error: any) {
    logger.error(`[WhatsApp] Cleanup job failed: ${error.message}`)
  }
}

export const config = {
  name: "cleanup-whatsapp-logs",
  schedule: "0 3 * * *",
}
