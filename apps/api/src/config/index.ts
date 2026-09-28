import path from "path";
import dotenv from "dotenv";

// Load .env from project root or current working directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  mqttUrl: string;
  jwtSecret: string;
  nodeEnv: string;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.API_PORT ?? "3001", 10),
    host: process.env.API_HOST ?? "0.0.0.0",
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/maitri_bharati",
    mqttUrl: process.env.MQTT_URL ?? "mqtt://localhost:1883",
    jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}
