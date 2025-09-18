// api/checkLink.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const url = req.query.url;
  if (!url) return res.status(400).json({ ok: false, message: "Missing url" });

  try {
    // Use GET instead of HEAD for Google Drive links
    const response = await fetch(url, { method: "GET" });

    // If status is 200-299, assume valid
    if (response.ok) {
      res.status(200).json({ ok: true });
    } else {
      res.status(404).json({ ok: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
}
