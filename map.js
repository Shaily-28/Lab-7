import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1Ijoic2hhaWx5LTI4IiwiYSI6ImNtaHpyaWN5NzBwbm0ya29wcGt1bGV6ZjQifQ.tPamgMp22xEispqmV_JRSQ';


console.log('Mapbox GL JS Loaded:', mapboxgl);


const map = new mapboxgl.Map({
  container: 'map', 
  style: 'mapbox://styles/mapbox/streets-v12', 
  center: [-71.09415, 42.36027], 
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

map.on('load', () => {
  console.log('Map has loaded!');
});
