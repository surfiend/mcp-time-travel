import { z } from "zod";
import { DebugLogger } from "../debug-logger.js";
import fs from "fs/promises";
import path from "path";

export const ViewDebugLogSchema = z.object({
  lines: z.number().optional().describe("Number of lines to show from the end of the log (default: 50)")
});

export interface DebugLogResult {
  logPath: string;
  totalLines: number;
  lines: string[];
}

export async function viewDebugLog(args: z.infer<typeof ViewDebugLogSchema>): Promise<DebugLogResult> {
  const linesToShow = args.lines || 50;
  const logPath = path.join(process.cwd(), '.mcp-checkpoint', 'debug.log');
  
  try {
    const logContent = await fs.readFile(logPath, 'utf8');
    const allLines = logContent.split('\n').filter(line => line.trim().length > 0);
    const lines = allLines.slice(-linesToShow);
    
    return {
      logPath,
      totalLines: allLines.length,
      lines
    };
  } catch (error) {
    return {
      logPath,
      totalLines: 0,
      lines: [`Debug log not found or empty. Error: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

export const ClearDebugLogSchema = z.object({});

export async function clearDebugLog(): Promise<{ success: boolean; message: string }> {
  try {
    await DebugLogger.clear();
    return {
      success: true,
      message: "Debug log cleared successfully"
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to clear debug log: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}