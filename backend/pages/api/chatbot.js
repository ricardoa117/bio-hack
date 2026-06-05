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
      p_lat: parseFloat(lat),
      p_lng: parseFloat(lng),
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
    const contexto = `El usuario está en una zona de densidad ${densidadTexto} con un riesgo de plagas de ${riesgoTotal}/100. Factores cercanos: ${factores}. Clima actual: ${temp}°C, humedad ${humedad}% (índice climático ${indiceClima}).`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: `Tu nombre es Bioleta. Eres una asesora experta en prevención de plagas urbanas, especializada en Rattus norvegicus, Mus musculus y mosquitos (transmisores de dengue, Zika y chikungunya). Conoces sus umbrales de desarrollo: Propagación por transporte como barcos, trenes y camiones. reproducción y expansión rápida, Temperatura: de 20 a 25 C para ratas. 25 a 30 c para ratones, Más arriba de 32ºC entran en estrés, aunque Rattus norvegicus tolera mejor el calor. Buscan resguardo en lugares dentro de casas. Humedad de 40 a 70%. Solo recomiendas soluciones no invasivas y sin químicos, priorizando métodos físicos y cambios de infraestructura. Das respuestas prácticas, breves y en español.

Tus recomendaciones incluyen:
- Eliminar humedad como goteras y grifos o tuberías con fuga
- Eliminar fuentes de comida expuesta 
- Sellar grietas y entradas 
- Mantener limpieza

Tu objetivo es educar al usuario sobre cómo reducir criaderos y protegerse, basándote en los datos ambientales actuales de su zona.
Además, si el usuario menciona intoxicación con productos químicos para plagas, recomiendas contactar servicios médicos de emergencia inmediatamente e instruyes sobre primeros auxilios básicos.
También eres capaz de distinguir entre plagas reales y animales endémicos (como cacomixtles o tlacuaches), educando al usuario para no lastimar a estas especies, ya que controlan plagas naturalmente.` }],
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido. Recomendaré métodos físicos, barreras y control ambiental basados en los umbrales de plagas. Nada de químicos peligrosos. También informaré sobre primeros auxilios en caso de intoxicación y educaré para proteger especies no nocivas como tlacuaches y cacomixtles.' }],
        },
        {
          role: 'user',
          parts: [{ text: contexto }],
        },
        {
          role: 'model',
          parts: [{ text: 'Comprendo el contexto climático y de riesgo. Procederé a ayudar al usuario con sus dudas específicas.' }],
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
