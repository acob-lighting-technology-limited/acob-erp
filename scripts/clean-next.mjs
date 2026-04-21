import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"

const nextDir = resolve(process.cwd(), ".next")

async function removeNextDirWithRetry(directory, attempts = 8) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      })
      return
    } catch (error) {
      const code = String(error?.code || "")
      const canRetry = code === "ENOTEMPTY" || code === "EPERM" || code === "EBUSY"
      if (!canRetry || index === attempts - 1) {
        throw error
      }
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 250 * (index + 1)))
    }
  }
}

if (existsSync(nextDir)) {
  await removeNextDirWithRetry(nextDir)
}
