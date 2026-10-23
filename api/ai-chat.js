// WINE AI endpoint for Vercel. Keep provider API keys in hosting Environment Variables.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || '').trim().slice(0, 1200);
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
    if (!message) return res.status(400).json({ error: 'Pesan kosong' });
    const system = 'Kamu adalah WINE AI, asisten untuk website MaserwinzStore/WINE Digital Market. Jawab dalam bahasa Indonesia santai, ringkas, dan akurat. Bantu menjelaskan cara melihat produk, checkout, metode pembayaran, deposit saldo minimal Rp1.000, upload bukti deposit, redeem code dan kuota, serta menghubungi admin. Jangan mengarang status pesanan, pembayaran, saldo, stok, atau kebijakan yang tidak terlihat. Jelaskan bahwa persetujuan deposit dilakukan admin. Jangan meminta password, OTP, token, atau data sensitif.';
    if (process.env.GROQ_API_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.4, max_tokens: 600, messages: [{ role: 'system', content: system }, ...history.filter(x => ['user','assistant'].includes(x.role)).map(x => ({ role: x.role, content: String(x.content).slice(0, 2000) })), { role: 'user', content: message }] })
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: 'Penyedia AI sedang bermasalah' });
      return res.status(200).json({ reply: data.choices?.[0]?.message?.content || 'Maaf, belum ada jawaban.' });
    }
    if (process.env.GEMINI_API_KEY) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [...history.filter(x => ['user','assistant'].includes(x.role)).map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(x.content).slice(0, 2000) }] })), { role: 'user', parts: [{ text: message }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 600 } })
      });
      const data = await response.json();
      if (!response.ok) return res.status(502).json({ error: 'Penyedia AI sedang bermasalah' });
      return res.status(200).json({ reply: data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'Maaf, belum ada jawaban.' });
    }
    return res.status(503).json({ error: 'API AI belum dikonfigurasi' });
  } catch (error) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada layanan AI' });
  }
};
