import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const app = createApp();

app.listen(config.port, config.host, () => {
  console.log(
    `[api] Maitri-Bharati API listening on http://${config.host}:${config.port}`
  );
  console.log(`[api] Health: http://${config.host}:${config.port}/health`);
  console.log(`[api] Ready:  http://${config.host}:${config.port}/ready`);
  console.log(`[api] Environment: ${config.nodeEnv}`);
});
