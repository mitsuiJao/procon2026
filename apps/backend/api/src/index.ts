import { Hono } from "hono";
import { serve } from "@hono/node-server"
import { cors } from "hono/cors";
import { routes } from "./routes";
import { startWeatherCron } from "./utils/cron-weather";

startWeatherCron();

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
    return c.text("Helloworld Hono!\n");
})

app.route("/api", routes);

serve({
    fetch: app.fetch,
    port: 3000,
    hostname: "0.0.0.0"
});
