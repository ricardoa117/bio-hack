export async function getDatosClima(lat, lng) {
  const API_KEY = process.env.WEATHER_API_KEY;
  if (!API_KEY) {
    console.warn('WEATHER_API_KEY no configurada, usando clima por defecto');
    return { humedad: 50, temp: 20 };
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      humedad: data.main.humidity,
      temp: data.main.temp,
    };
  } catch (error) {
    console.error('Error obteniendo clima:', error);
    return { humedad: 50, temp: 20 };
  }
}

export function calcularIndiceClima(humedad, temp) {
  if (humedad > 80 && temp > 22) return 1;
  if (humedad > 70 || temp > 25) return 0.8;
  if (humedad < 40 && temp < 15) return 0.4;
  return 0.6;
}