import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { data, error } = await supabase
      .from('reportes')
      .select('id, lat, lng, tipo_precursor, peso, descripcion, created_at')
      .gte('created_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo reportes:', error);
      return res.status(500).json({ error: 'Error al obtener reportes' });
    }

    return res.status(200).json({ reportes: data || [] });
  } catch (err) {
    console.error('Error en endpoint reportes:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
