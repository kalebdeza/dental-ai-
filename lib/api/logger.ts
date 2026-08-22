type LogLevel = "info" | "warn" | "error";

class Logger {
  private write(level: LogLevel, message: string, meta?: unknown) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };

    switch (level) {
      case "info":
        console.info(log);
        break;

      case "warn":
        console.warn(log);
        break;

      case "error":
        console.error(log);
        break;
    }
  }

  info(message: string, meta?: unknown) {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: unknown) {
    this.write("error", message, meta);
  }
}

export const logger = new Logger();