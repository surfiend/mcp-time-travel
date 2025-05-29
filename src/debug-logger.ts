import fs from "fs/promises";
import path from "path";

/**
 * Simple file-based debug logger for MCP server debugging
 * Logs to .mcp-checkpoint/debug.log in the working directory
 */
export class DebugLogger {
  private static logPath: string | null = null;
  private static enabled = true;

  private static async getLogPath(): Promise<string> {
    if (this.logPath) {
      return this.logPath;
    }
    
    const logDir = path.join(process.cwd(), '.mcp-checkpoint');
    await fs.mkdir(logDir, { recursive: true });
    this.logPath = path.join(logDir, 'debug.log');
    return this.logPath;
  }

  private static async writeLog(level: string, message: string, data?: any): Promise<void> {
    if (!this.enabled) return;
    
    try {
      const timestamp = new Date().toISOString();
      const logEntry = data 
        ? `[${timestamp}] ${level}: ${message} ${JSON.stringify(data, null, 2)}\n`
        : `[${timestamp}] ${level}: ${message}\n`;
      
      const logPath = await this.getLogPath();
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      // Silently fail to avoid breaking the main functionality
    }
  }

  static async info(message: string, data?: any): Promise<void> {
    await this.writeLog('INFO', message, data);
  }

  static async warn(message: string, data?: any): Promise<void> {
    await this.writeLog('WARN', message, data);
  }

  static async error(message: string, data?: any): Promise<void> {
    await this.writeLog('ERROR', message, data);
  }

  static async debug(message: string, data?: any): Promise<void> {
    await this.writeLog('DEBUG', message, data);
  }

  static async clear(): Promise<void> {
    try {
      const logPath = await this.getLogPath();
      await fs.writeFile(logPath, '');
    } catch (error) {
      // Silently fail
    }
  }

  static disable(): void {
    this.enabled = false;
  }

  static enable(): void {
    this.enabled = true;
  }
}