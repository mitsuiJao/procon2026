import { Hono } from "hono";
import { calendar } from "./calendar";
import { current } from "./current";
import { diary } from "./diary";
import { diseases } from "./diseases";
import { observations } from "./observations";
import { pesticides } from "./pesticides";
import { sensors } from "./sensors";
import { sprays } from "./sprays";
import { stages } from "./stages";

export const routes = new Hono()
  .route("/calendar", calendar)
  .route("/current", current)
  .route("/sensors", sensors)
  .route("/diseases", diseases)
  .route("/stages", stages)
  .route("/diary", diary)
  .route("/observations", observations)
  .route("/sprays", sprays)
  .route("/pesticides", pesticides);
