import { Server as WebSocketServer } from 'ws';
import { verifyToken } from '../utils/helpers.js';
import { pool } from '../config/index.js';

export function createWebSocketServer(server: any) {
  const wss = new WebSocketServer({ noServer: true, path: '/ws' });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    try {
      // Extract token from query params
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify token
      const { userId } = verifyToken(token);

      wss.handleUpgrade(request, socket, head, (ws) => {
        const client = ws as any;
        client.userId = userId;
        client.isAlive = true;

        client.on('pong', () => {
          client.isAlive = true;
        });

        wss.emit('connection', client, request);
      });
    } catch (error) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: any) => {
    console.log(`WebSocket client connected: ${ws.userId}`);

    // Join user's personal rooms
    ws.joinUserRoom = (roomId: string) => {
      if (!ws.rooms) ws.rooms = new Set();
      ws.rooms.add(roomId);
    };

    ws.leaveUserRoom = (roomId: string) => {
      if (ws.rooms) ws.rooms.delete(roomId);
    };

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'subscribe':
            // Subscribe to a chat room
            if (message.roomId) {
              ws.joinUserRoom(message.roomId);

              // Verify participation
              const room = await pool.query(
                'SELECT * FROM chat_rooms WHERE id = $1 AND $2 = ANY(participants)',
                [message.roomId, ws.userId]
              );

              if (room.rows.length > 0) {
                ws.send(JSON.stringify({
                  type: 'subscribed',
                  roomId: message.roomId,
                }));
              }
            }
            break;

          case 'unsubscribe':
            if (message.roomId) {
              ws.leaveUserRoom(message.roomId);
            }
            break;

          case 'typing':
            // Broadcast typing indicator to room
            if (message.roomId) {
              wss.clients?.forEach((client: any) => {
                if (client !== ws && client.rooms?.has(message.roomId)) {
                  client.send(JSON.stringify({
                    type: 'typing',
                    roomId: message.roomId,
                    indicator: {
                      userId: ws.userId,
                      isTyping: message.isTyping,
                    },
                  }));
                }
              });
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket client disconnected: ${ws.userId}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    wss.clients?.forEach((ws: any) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  return wss;
}

// Helper function to broadcast to a room
export function broadcastToRoom(wss: any, roomId: string, message: any) {
  wss.clients?.forEach((client: any) => {
    if (client.rooms?.has(roomId)) {
      client.send(JSON.stringify(message));
    }
  });
}

// Helper function to send to a specific user
export function sendToUser(wss: any, userId: string, message: any) {
  wss.clients?.forEach((client: any) => {
    if (client.userId === userId && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}
