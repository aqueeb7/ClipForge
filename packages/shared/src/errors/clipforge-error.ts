import { ErrorCode } from "./codes.js";

export interface ClipForgeErrorOptions {
  code: ErrorCode;
  message: string;
  targetPath?: string;
  diagnosticContext?: Record<string, unknown>;
  suggestedAction?: string;
  cause?: unknown;
}

export class ClipForgeError extends Error {
  public readonly code: ErrorCode;
  public readonly targetPath?: string;
  public readonly diagnosticContext?: Record<string, unknown>;
  public readonly suggestedAction?: string;

  constructor(options: ClipForgeErrorOptions) {
    super(options.message);
    this.name = "ClipForgeError";
    this.code = options.code;
    this.targetPath = options.targetPath;
    this.diagnosticContext = options.diagnosticContext;
    this.suggestedAction = options.suggestedAction;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }

    Object.setPrototypeOf(this, ClipForgeError.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      targetPath: this.targetPath,
      diagnosticContext: this.diagnosticContext,
      suggestedAction: this.suggestedAction,
      stack: this.stack
    };
  }
}
