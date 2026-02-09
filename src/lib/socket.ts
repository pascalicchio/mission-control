import { Server as NetServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Use global socket instance
let io: SocketIOServer | null = null;

export const initSocket = (server: NetServer) => {
  io = new SocketIOServer(server, {
    path: '/api/socket',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log('🔌 Client connected:', socket.id);
    
    socket.on('subscribe', (room: string) => {
      socket.join(room);
    });
    
    socket.on('disconnect', () => {
      // Silent disconnect
    });
  });

  return io;
};

export const getIO = () => io;

export const emitTaskUpdate = (event: string, data: any) => {
  if (io) {
    io.to('tasks').emit(event, data);
    io.to('dashboard').emit(event, data);
    io.emit(event, data); // Also emit to all clients
  }
};

export const emitAgentUpdate = (data: any) => {
  if (io) {
    io.to('agents').emit('agent:update', data);
    io.to('dashboard').emit('agent:update', data);
    io.emit('agent:update', data);
  }
};

export const emitActivity = (data: any) => {
  if (io) {
    io.to('activity').emit('activity:new', data);
    io.emit('activity:new', data);
  }
};
