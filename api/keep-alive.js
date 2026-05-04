export default async function handler(req, res) {
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/profesionales?select=id&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error("Supabase no respondió correctamente");
    }

    res.status(200).json({ status: "Supabase activo" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}