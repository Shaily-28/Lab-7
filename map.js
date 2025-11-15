import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const STATIONS_URL =
  'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

const TRIPS_URL =
  'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';

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

const svg = d3.select('#map').select('svg');


function getCoords(station) {
  const lon = +(station.lon ?? station.Long ?? station.longitude ?? station.Lon);
  const lat = +(station.lat ?? station.Lat ?? station.latitude ?? station.Latitude);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.warn('Missing or invalid coordinates for station:', station);
    return { cx: -1000, cy: -1000 };
  }

  const point = new mapboxgl.LngLat(lon, lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id,
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id,
  );

  return stations.map((station) => {
    const id = station.short_name;
    station.arrivals = arrivals.get(id) ?? 0;
    station.departures = departures.get(id) ?? 0;
    station.totalTraffic = station.arrivals + station.departures;
    return station;
  });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter((trip) => {
        const startedMinutes = minutesSinceMidnight(trip.started_at);
        const endedMinutes = minutesSinceMidnight(trip.ended_at);
        return (
          Math.abs(startedMinutes - timeFilter) <= 60 ||
          Math.abs(endedMinutes - timeFilter) <= 60
        );
      });
}

function formatTime(minutes) {
  if (minutes < 0) return '';
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

map.on('load', async () => {
  console.log('Map has loaded!');


  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?outSR=%7B%22latestWkid%22%3A3857%2C%22wkid%22%3A102100%7D',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });

  
  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
  });

  map.addLayer({
    id: 'cambridge-bike-lanes',
    type: 'line',
    source: 'cambridge_route',
    paint: {
      'line-color': '#32D400',
      'line-width': 5,
      'line-opacity': 0.6,
    },
  });


  let stations;
  try {
    const jsonData = await d3.json(STATIONS_URL);
    stations = jsonData.data.stations;
  } catch (e) {
    console.error('Error loading stations:', e);
    return;
  }

  let trips;
  try {
    trips = await d3.csv(TRIPS_URL, (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    });
  } catch (e) {
    console.error('Error loading trips:', e);
    return;
  }


  stations = computeStationTraffic(stations, trips);

  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  const circles = svg
    .selectAll('circle')
    .data(stations, (d) => d.short_name)
    .enter()
    .append('circle')
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .attr('r', (d) => radiusScale(d.totalTraffic));


  const tooltip = d3
    .select('#map')
    .append('div')
    .attr('id', 'tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background', 'white')
    .style('padding', '4px 8px')
    .style('border-radius', '4px')
    .style('font-size', '12px')
    .style('box-shadow', '0 2px 6px rgba(0, 0, 0, 0.3)')
    .style('opacity', 0);

  circles
    .on('mouseenter', (event, d) => {
      tooltip
        .style('opacity', 1)
        .text(
          `${d.name ?? 'Station'}: ${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
        );
    })
    .on('mousemove', (event) => {
      const [x, y] = d3.pointer(event, map.getContainer());
      tooltip.style('left', x + 10 + 'px').style('top', y + 10 + 'px');
    })
    .on('mouseleave', () => {
      tooltip.style('opacity', 0);
    });

  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function updateTimeDisplay(timeFilter) {
    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }
  }

  function updateScatterPlot(timeFilter) {
    const filteredTrips = filterTripsByTime(trips, timeFilter);
    computeStationTraffic(stations, filteredTrips);

    radiusScale.domain([
      0,
      d3.max(stations, (d) => d.totalTraffic) || 0,
    ]);

    circles.attr('r', (d) => radiusScale(d.totalTraffic));
  }

  timeSlider.addEventListener('input', () => {
    const timeFilter = Number(timeSlider.value);
    updateTimeDisplay(timeFilter);
    updateScatterPlot(timeFilter);
    updatePositions();
  });


  updateTimeDisplay(Number(timeSlider.value));
});
