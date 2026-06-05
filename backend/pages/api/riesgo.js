import { supabase } from '../../lib/supabaseClient';
import { getRiesgoBasal } from '../../lib/riesgoBasal';
import { getDatosClima, calcularIndiceClima } from '../../lib/clima';

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

  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Se requieren lat y lng' });
  }

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);

  try {
    const riesgoBasal = getRiesgoBasal(latF, lngF);

    const { data: reportes, error } = await supabase.rpc('reportes_cercanos', {
      p_lat: latF,
      p_lng: lngF,
      radius_meters: 15000,
    });

    console.log('RPC Error:', error);
    console.log('RPC Reportes:', reportes);

    let sumaNormalizada = 0;
    if (!error && reportes) {
      const now = new Date();
      let sumaPonderada = 0;
      reportes.forEach((r) => {
        const horas = (now - new Date(r.created_at)) / 36e5;
        const factor = Math.max(0, 1 - horas / 72);
        sumaPonderada += r.peso * factor;
      });
      sumaNormalizada = Math.min(100, sumaPonderada * 2);
    }

    const { humedad, temp } = await getDatosClima(latF, lngF);
    const indiceClima = calcularIndiceClima(humedad, temp);

    // Pest Probability Calculations
    let pesoAgua = 0;
    let pesoBasura = 0;
    let pesoBaldio = 0;

    if (!error && reportes) {
      const now = new Date();
      reportes.forEach((r) => {
        const horas = (now - new Date(r.created_at)) / 36e5;
        const temporalFactor = Math.max(0, 1 - horas / 72);
        
        // Calcular distancia manualmente (Haversine) si el RPC no la incluye
        let dist = r.distancia_m || r.dist_meters;
        if (dist === undefined) {
          const R = 6371e3; // Radio de la Tierra en metros
          const rad = Math.PI / 180;
          const dLat = (r.lat - latF) * rad;
          const dLng = (r.lng - lngF) * rad;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(latF * rad) * Math.cos(r.lat * rad) *
                    Math.sin(dLng/2) * Math.sin(dLng/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          dist = R * c;
        }

        r.distancia_real_m = dist; // Guardar para usarlo en cantidad_reportes luego

        // Decaimiento espacial: Pierde fuerza exponencialmente después de 1km
        const spatialFactor = Math.exp(-dist / 1500); 
        const adjustedPeso = r.peso * temporalFactor * spatialFactor;

        if (r.tipo_precursor === 'fuga_agua' || r.tipo_precursor === 'barranca_sucia') pesoAgua += adjustedPeso;
        if (r.tipo_precursor === 'basura_organica' || r.tipo_precursor === 'barranca_sucia') pesoBasura += adjustedPeso;
        if (r.tipo_precursor === 'terreno_baldio' || r.tipo_precursor === 'basura_inorganica') pesoBaldio += adjustedPeso;
      });
    }

    const probMosquitos = Math.min(100, Math.round(riesgoBasal * 0.4 + pesoAgua * 3 + indiceClima * 40));
    const probCucarachas = Math.min(100, Math.round(riesgoBasal * 0.5 + pesoBasura * 3 + (temp > 25 ? 15 : 0)));
    const probRatas = Math.min(100, Math.round(riesgoBasal * 0.5 + pesoBasura * 2 + pesoBaldio * 2));

    const riesgoTotal = Math.round(
      riesgoBasal * 0.4 + sumaNormalizada * 0.4 + indiceClima * 100 * 0.2
    );
    const riesgoTotalLimitado = Math.min(100, riesgoTotal);

    let mensaje = null;
    if (riesgoTotalLimitado >= 85) {
      mensaje = 'ALERTA ROJA: Condiciones críticas. Sella grietas, elimina basura y revisa humedades.';
    } else if (riesgoTotalLimitado >= 70) {
      mensaje = 'ALERTA AMARILLA: Riesgo elevado. Recomendamos instalar mosquiteros y revisar tuberías.';
    }

    return res.status(200).json({
      riesgo_total: riesgoTotalLimitado,
      riesgo_basal: riesgoBasal,
      suma_reportes: sumaNormalizada,
      cantidad_reportes: reportes ? reportes.filter(r => r.distancia_real_m <= 1000).length : 0,
      probabilidades: {
        mosquitos: probMosquitos,
        cucarachas: probCucarachas,
        ratas: probRatas
      },
      mensaje_alerta: mensaje,
      clima: { humedad, temp, indice_clima: indiceClima },
    });
  } catch (err) {
    console.error('Error en endpoint riesgo:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
