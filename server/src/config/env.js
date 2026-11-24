import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_ENV_PATH = path.resolve(__dirname, '../../../.env');

dotenv.config({ path: ROOT_ENV_PATH });

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

/**
 * Resolves runtime configuration from environment variables and optional overrides.
 * Never returns or exposes raw API keys via public config helpers.
 */
export function getConfig(overrides = {}) {
  const apiKey = String(overrides.apiKey ?? process.env.GEMINI_API_KEY ?? '').trim();
  const configuredModel = String(overrides.model ?? process.env.GEMINI_MODEL ?? '').trim();
  const model = configuredModel || DEFAULT_GEMINI_MODEL;
  const parsedPort = Number(overrides.port ?? process.env.PORT ?? 3001);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3001;
  const clientOrigin = String(
    overrides.clientOrigin ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  ).trim();

  return {
    apiKey,
    isConfigured: Boolean(apiKey),
    model,
    defaultModel: DEFAULT_GEMINI_MODEL,
    port,
    clientOrigin,
  };
}

/**
 * Returns non-sensitive server configuration safe to send to browsers.
 */
export function getPublicConfig(config) {
  return {
    configured: Boolean(config.isConfigured),
    model: config.model,
    defaultModel: config.defaultModel,
  };
}
