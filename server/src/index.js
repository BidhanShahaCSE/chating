import { createApp } from './app.js';
import { getConfig } from './config/env.js';

const config = getConfig();
const app = createApp();

app.listen(config.port, () => {
  const keyStatus = config.isConfigured
    ? 'configured'
    : 'missing (add GEMINI_API_KEY in .env)';
  console.log(
    `[chating-server] Listening on http://localhost:${config.port} | model=${config.model} | GEMINI_API_KEY=${keyStatus}`,
  );
});
