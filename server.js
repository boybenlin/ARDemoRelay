import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('AR relay is running');
});

const relay = new WebSocketServer({ server, maxPayload: 512 });
let latestPose;

relay.on('connection', (socket, request) => {
  const role = new URL(request.url, 'http://localhost').searchParams.get('role');

  if (role !== 'phone' && role !== 'tv') {
    socket.close(1008, 'Choose a phone or TV role');
    return;
  }

  socket.role = role;
  socket.on('error', console.error);

  if (role === 'tv' && latestPose) socket.send(latestPose);

  socket.on('message', raw => {
    if (role !== 'phone') return;

    let pose;
    try {
      pose = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { x, z, yaw } = pose ?? {};
    if (![x, z, yaw].every(Number.isFinite)) return;

    latestPose = JSON.stringify({ x, z, yaw });
    for (const viewer of relay.clients) {
      if (viewer.role === 'tv' && viewer.readyState === WebSocket.OPEN) {
        viewer.send(latestPose);
      }
    }
  });
});

server.listen(Number(process.env.PORT || 10000), '0.0.0.0');