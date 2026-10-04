import type { GigMapPin } from './gigMapData';
import type { Coordinates } from '../types/gig';

// Escape JSON embedded in an HTML script, including untrusted gig titles.
function scriptJSON(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function createGeoapifyMapHTML(pins: GigMapPin[], apiKey: string, location?: { point?: Coordinates; editable?: boolean }) {
  const data = pins.map(pin => ({ key: pin.key, latitude: pin.coordinates.latitude, longitude: pin.coordinates.longitude,
    count: pin.gigs.length, title: pin.gigs.length === 1 ? pin.gigs[0].title : `${pin.gigs.length} gigs at this location` }));
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>html,body,#map{height:100%;width:100%;margin:0;background:#FAF9F6}.gig-pin{background:#087F73;border:2px solid white;border-radius:50%;color:white;text-align:center;line-height:28px;font-weight:bold;box-shadow:0 2px 6px #0004}.leaflet-control-attribution{max-width:calc(100vw - 12px);font-size:10px}</style></head><body><div id="map" role="application" aria-label="Gig locations"></div>
<script>function emit(type,key,point){var message={channel:'gigzy-map',type:type,key:key,point:point};if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));else window.parent.postMessage(message,'*');}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" onerror="emit('error')"></script>
<script>
try {
var pins=${scriptJSON(data)}, apiKey=${scriptJSON(apiKey)};
var locationOptions=${scriptJSON(location ?? null)}, locationMarker=null, selectedPoint=locationOptions&&locationOptions.point;
var map=L.map('map').setView([6.9271,79.8612],11), userMarker=null, loaded=false;
var tiles=L.tileLayer('https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey='+encodeURIComponent(apiKey),{
maxZoom:20,attribution:'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>'
});
tiles.on('tileload',function(){if(!loaded){loaded=true;emit('loaded');}});
tiles.on('load',function(){if(!loaded)emit('error');});
tiles.addTo(map);
pins.forEach(function(pin){
var label=document.createElement('span');label.textContent=pin.title;
var marker=L.marker([pin.latitude,pin.longitude],{title:pin.title,keyboard:true,icon:L.divIcon({className:'gig-pin',html:pin.count>1?String(pin.count):'&#8226;',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
marker.bindTooltip(label);marker.on('click',function(){emit('pin',pin.key);});
});
function selectPoint(point,notify){
selectedPoint=point;
if(locationMarker)locationMarker.setLatLng([point.latitude,point.longitude]);
else {locationMarker=L.marker([point.latitude,point.longitude],{draggable:!!locationOptions.editable,title:'Gig location',icon:L.divIcon({className:'gig-pin',html:'&#8226;',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
locationMarker.on('dragend',function(){var point=locationMarker.getLatLng();selectPoint({latitude:point.lat,longitude:point.lng},true);});}
if(notify)emit('location',null,point);
}
if(locationOptions){if(selectedPoint)selectPoint(selectedPoint,false);if(locationOptions.editable)map.on('click',function(event){selectPoint({latitude:event.latlng.lat,longitude:event.latlng.lng},true);});}
function fit(){if(selectedPoint)map.setView([selectedPoint.latitude,selectedPoint.longitude],15);else if(pins.length===1)map.setView([pins[0].latitude,pins[0].longitude],14);else if(pins.length)map.fitBounds(pins.map(function(pin){return [pin.latitude,pin.longitude];}),{padding:[40,40],maxZoom:15});}
window.gigzyCommand=function(command){if(command.type==='clear-location'&&locationOptions){if(locationMarker)map.removeLayer(locationMarker);locationMarker=null;selectedPoint=null;}else if(command.type==='set-location'&&locationOptions&&Number.isFinite(command.latitude)&&Number.isFinite(command.longitude)){selectPoint(command,false);fit();}else if(command.type==='fit')fit();else if(command.type==='locate'&&Number.isFinite(command.latitude)&&Number.isFinite(command.longitude)){
if(userMarker)map.removeLayer(userMarker);userMarker=L.circleMarker([command.latitude,command.longitude],{radius:7,color:'#fff',weight:2,fillColor:'#2379db',fillOpacity:1}).addTo(map);map.setView([command.latitude,command.longitude],13);
}};
window.addEventListener('message',function(event){if(event.source===window.parent&&event.data&&event.data.channel==='gigzy-map-command')window.gigzyCommand(event.data);});
fit();emit('ready');
}catch(error){emit('error');}
</script></body></html>`;
}
