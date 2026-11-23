import { bearerAuth } from "hono/bearer-auth";

/** 共有Bearerトークン認証。API_TOKEN 未設定なら起動時に失敗させる(fail-closed)。 */
export function createAuth(token = process.env.API_TOKEN) {
    if (!token) throw new Error("API_TOKEN is not set");
    return bearerAuth({ token });
}
