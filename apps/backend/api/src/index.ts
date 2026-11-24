import { Hono } from "hono";
import { serve } from "@hono/node-server"
import { cors } from "hono/cors";
import { routes } from "./routes";
import { createAuth } from "./middleware/auth";
import { startWeatherCron } from "./utils/cron-weather";

startWeatherCron();

const app = new Hono();

app.use(
    "*",
    cors({
        origin: process.env.CORS_ORIGIN ?? "*",
        allowHeaders: ["Authorization", "Content-Type"],
    }),
);

app.get("/", (c) => {
    return c.text("Helloworld Hono!\n");
})

app.use("/api/*", createAuth());
app.route("/api", routes);

serve({
    fetch: app.fetch,
    port: Number(process.env.PORT ?? 3000),
    hostname: "0.0.0.0"
});
