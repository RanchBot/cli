/**
 * A CLI error carries a user-facing message and a process exit code. Non-CliError
 * throws (bugs, unexpected failures) are reported with a generic message + exit 1.
 */
export class CliError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

/**
 * Normalise anything thrown into a single { error, message, status? } shape for the
 * stderr JSON error envelope. Axios errors from the API surface their server message.
 */
export interface ErrorEnvelope {
  error: string;
  message: string;
  status?: number;
}

export function toErrorEnvelope(err: unknown): ErrorEnvelope {
  if (err instanceof CliError) {
    return { error: err.name, message: err.message };
  }

  const anyErr = err as { isAxiosError?: boolean; response?: any; message?: string; code?: string };
  if (anyErr?.isAxiosError) {
    const status = anyErr.response?.status;
    const serverMessage =
      anyErr.response?.data?.message ||
      anyErr.response?.data?.error ||
      anyErr.response?.data?.error_description;
    // Auth-shaped API errors map to a clear "log in again" message.
    if (status === 401 || status === 403) {
      return {
        error: 'AuthError',
        message: serverMessage || 'Authentication failed. Run `ranchbot login`.',
        status,
      };
    }
    return {
      error: 'ApiError',
      message: serverMessage || anyErr.message || 'API request failed.',
      status,
    };
  }

  return {
    error: (err as Error)?.name || 'Error',
    message: (err as Error)?.message || 'Unknown error.',
  };
}
