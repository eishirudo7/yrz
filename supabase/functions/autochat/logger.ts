// Logger utility untuk Edge Function

class Logger {
  async info(message: string) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`)
  }

  async error(message: string) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`)
  }

  async warning(message: string) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`)
  }

  async debug(message: string) {
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`)
  }
}

export const logger = new Logger() 