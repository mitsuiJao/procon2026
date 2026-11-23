import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAuth } from "../src/middleware/auth";

function makeApp() {
    const app = new Hono();
    app.get("/", (c) => c.text("ok"));
    app.use("/api/*", createAuth("secret"));
    app.get("/api/x", (c) => c.text("data"));
    return app;
}

test("ヘルスチェックは認証不要", async () => {
    assert.equal((await makeApp().request("/")).status, 200);
});

test("トークンなしは401", async () => {
    assert.equal((await makeApp().request("/api/x")).status, 401);
});

test("誤ったトークンは401", async () => {
    const r = await makeApp().request("/api/x", { headers: { Authorization: "Bearer wrong" } });
    assert.equal(r.status, 401);
});

test("正しいトークンは200", async () => {
    const r = await makeApp().request("/api/x", { headers: { Authorization: "Bearer secret" } });
    assert.equal(r.status, 200);
});

test("トークン未設定なら生成時に失敗する", () => {
    assert.throws(() => createAuth(""));
});
