export interface SystemConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
  defaultOutputDirectory: string;
  concurrency: number;
}

export function getDefaultSystemConfig(): SystemConfig {
  return {
    defaultOutputDirectory: "./Exports",
    concurrency: 1
  };
}
