import { Hono } from "hono";
import { serve } from "@hono/node-server"
import { cors } from "hono/cors";
import { startWeatherCron } from "./utils/cron-weather";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
    return c.text("Helloworld Hono!\n");
})

serve({
    fetch: app.fetch,
    port: 3000,
    hostname: "0.0.0.0"
});

startWeatherCron();
