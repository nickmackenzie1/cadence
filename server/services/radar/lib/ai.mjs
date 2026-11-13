import { AI_MODEL } from "./config.mjs";
import { httpJson } from "./http.mjs";

export const hasAI = () => !!process.env.ANTHROPIC_API_KEY;

export async function claude(prompt, maxTokens = 3000) {
  const resp = await httpJson("https://api.anthropic.com/v1/messages", {
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01",
               "content-type": "application/json" },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  return resp.content.map((c) => c.text || "").join("");
}

export function parseJson(text) {
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  return JSON.parse(text.slice(start, end + 1));
}
