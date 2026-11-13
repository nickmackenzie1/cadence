import { USER_AGENT } from "./config.mjs";

export async function httpJson(url, { headers = {}, body, method } = {}) {
  const res = await fetch(url, {
    method: method || (body ? "POST" : "GET"),
    headers: { "User-Agent": USER_AGENT, ...headers },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.split("?")[0]}`);
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}
