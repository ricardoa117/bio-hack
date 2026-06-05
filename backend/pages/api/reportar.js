import { supabase } from '../../lib/supabaseClient';
import { getPeso } from '../../lib/pesosPrecursores';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { lat, lng, tipo_precursor, descripcion } = req.body;
  if (!lat || !lng || !tipo_precursor) {
    return res.status(400).json({ error: 'Faltan coordenadas o tipo de precursor' });
  }

  const peso = getPeso(tipo_precursor);

  const { data, error } = await supabase
    .from('reportes')
    .insert({ lat, lng, tipo_precursor, peso, descripcion: descripcion || '' })
    .select('id')
    .single();

  if (error) {
    console.error('Error insertando reporte:', error);
    return res.status(500).json({ error: 'Error al guardar el reporte' });
  }

  return res.status(200).json({ id: data.id });
}
