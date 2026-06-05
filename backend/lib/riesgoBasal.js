import { readFileSync } from 'fs';
import { point, booleanPointInPolygon } from '@turf/turf';
import path from 'path';

let geojson = null;

function cargarGeoJSON() {
  if (!geojson) {
    const filePath = path.join(process.cwd(), '..', 'frontend', 'public', 'densidad.geojson');
    try {
      geojson = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error('Error cargando densidad.geojson:', error);
      geojson = { type: 'FeatureCollection', features: [] };
    }
  }
  return geojson;
}

export function getRiesgoBasal(lat, lng) {
  const data = cargarGeoJSON();
  const pt = point([lng, lat]);
  for (const feature of data.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return feature.properties.riesgo_basal;
    }
  }
  return 20;
}
