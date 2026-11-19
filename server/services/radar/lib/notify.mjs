// Phone alerts via ntfy.sh (free app for iOS/Android; no account needed).
// Pick a hard-to-guess topic name, subscribe to it in the app, set NTFY_TOPIC.
// no tags: ntfy shows a tag like "musical_note" as an emoji, and Cadence shows none (user, 2026-11-18)
const noEmoji = x => String(x || "").replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s?/gu, "").trim();
export async function notify({ title, message, url }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  try {
    const res = await fetch(process.env.NTFY_SERVER || "https://ntfy.sh", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, title: noEmoji(title), message: noEmoji(message), click: url }),
    });
    return res.ok;
  } catch { return false; }
}
