import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../../lib/supabaseClient';
import { getRiesgoBasal } from '../../lib/riesgoBasal';
import { getDatosClima, calcularIndiceClima } from '../../lib/clima';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

  const { mensaje, lat, lng } = req.body;
  if (!mensaje || !lat || !lng) {
    return res.status(400).json({ error: 'Faltan mensaje o coordenadas' });
  }

  try {
    const riesgoBasal = getRiesgoBasal(lat, lng);
    const { data: reportes, error } = await supabase.rpc('reportes_cercanos', {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius_meters: 1000,
    });

    let suma = 0;
    let factores = 'ninguno reciente';
    if (!error && reportes) {
      const now = new Date();
      reportes.forEach((r) => {
        const horas = (now - new Date(r.created_at)) / 36e5;
        suma += r.peso * Math.max(0, 1 - horas / 72);
      });
      factores = reportes.map((r) => r.tipo_precursor).join(', ') || factores;
    }

    const { humedad, temp } = await getDatosClima(lat, lng);
    const indiceClima = calcularIndiceClima(humedad, temp);

    const sumaNorm = Math.min(100, suma * 2);
    const riesgoTotal = Math.min(100, Math.round(riesgoBasal * 0.5 + sumaNorm * 0.3 + indiceClima * 100 * 0.2));
    const densidadTexto = riesgoBasal > 70 ? 'alta' : riesgoBasal > 40 ? 'media' : 'baja';
    const contexto = El usuario está en una zona de densidad  con un riesgo de plagas de /100. Factores cercanos: . Clima actual: °C, humedad % (índice climático ).;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Eres un asesor experto en prevención de plagas. Solo recomiendas soluciones no invasivas, sin químicos. Das respuestas prácticas, breves y en español. Al final, si es útil, sugieres productos como mallas mosquiteras, espuma de poliuretano o deshumidificadores.' }],
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido. Recomendaré métodos físicos, cambios de infraestructura y control ambiental. Nada de químicos.' }],
        },
        {
          role: 'user',
          parts: [{ text: contexto }],
        },
        {
          role: 'model',
          parts: [{ text: 'Comprendo el contexto. Procederé a ayudar al usuario.' }],
        },
      ],
    });

    const result = await chat.sendMessage(mensaje);
    const respuesta = result.response.text();

    return res.status(200).json({ respuesta });
  } catch (error) {
    console.error('Error en chatbot:', error);
    return res.status(500).json({ error: 'Error al procesar la consulta' });
  }
}
