// ipToCoords.js
import fetch from 'node-fetch';

// Replace with your list of IPs
const ips = [
  "8.8.8.8",
  "1.1.1.1",
  // add all your "good" IPs here
];

async function getCoordinates(ip) {
  const res = await fetch(`http://ip-api.com/json/${ip}`);
  const data = await res.json();
  if (data.status === 'success') {
    return { ip, lat: data.lat, lng: data.lon };
  } else {
    console.warn(`Failed for IP: ${ip}`);
    return null;
  }
}

async function main() {
  const coordsArray = [];
  for (const ip of ips) {
    const coords = await getCoordinates(ip);
    if (coords) coordsArray.push(coords);
  }
  console.log(coordsArray);
}

main();
