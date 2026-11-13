// Phone alerts via ntfy.sh (free app for iOS/Android; no account needed).
// Pick a hard-to-guess topic name, subscribe to it in the app, set NTFY_TOPIC.
export async function notify({ title, message, url, tags = "musical_note" }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  try {
    const res = await fetch(process.env.NTFY_SERVER || "https://ntfy.sh", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, title, message, click: url, tags: tags.split(",") }),
    });
    return res.ok;
  } catch { return false; }
}
