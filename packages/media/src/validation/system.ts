import fs from "node:fs/promises";
import path from "node:path";

export interface DiskSpaceInfo {
  availableBytes: number;
  totalBytes: number;
  availableGb: number;
}

export async function checkDirectoryWritable(dirPath: string): Promise<boolean> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    const testFile = path.join(dirPath, `.clipforge_write_test_${Date.now()}`);
    await fs.writeFile(testFile, "ok", "utf8");
    await fs.unlink(testFile);
    return true;
  } catch {
    return false;
  }
}

export async function getDiskSpace(targetPath: string): Promise<DiskSpaceInfo | null> {
  try {
    // statfs is supported in modern Node
    if (typeof fs.statfs === "function") {
      const stats = await fs.statfs(targetPath);
      const availableBytes = Number(stats.bavail) * Number(stats.bsize);
      const totalBytes = Number(stats.blocks) * Number(stats.bsize);
      const availableGb = Math.round((availableBytes / (1024 * 1024 * 1024)) * 10) / 10;
      return {
        availableBytes,
        totalBytes,
        availableGb
      };
    }
    return null;
  } catch {
    return null;
  }
}
