
let io;

module.exports = {
  
  init: (server) => {
    io = require('socket.io')(server, {
      cors: {
       origin: ["http://localhost:8081", "http://localhost:3000"], 
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
      }
    });
      io.on('connection', (socket) => {
      console.log('A client connected', socket.id);
      
      socket.on('join-code', (code) => {
        console.log(`Client ${socket.id} joined code room: ${code}`);
        socket.join(`code-${code}`);
        socket.emit('joined-code', { success: true, code });
        
        if (socket.previousCode && socket.previousCode !== code) {
          socket.leave(`code-${socket.previousCode}`);
          console.log(`Client ${socket.id} left previous code room: ${socket.previousCode}`);
        }
        
        socket.previousCode = code;
      });
      
      
      socket.on('disconnect', () => {
        console.log('A client disconnected', socket.id);
      });
    });
    
    return io;
  },
  
  
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    return io;
  },
  
  emitSessionUpdate: (event, data, room) => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    
    if (!room) {
      throw new Error('Room name is required for session updates');
    }
    
    io.to(room).emit(event, data);
    const codeMatch = room.match(/^code-(.+)$/);
    if (codeMatch && codeMatch[1]) {
      const sessionCode = codeMatch[1];
      io.to(room).emit(`session-update-${sessionCode}`, data);
    }
  },
  
  
  broadcastSessionUpdate: (event, data) => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    
    console.log(`Broadcasting ${event} to all clients`, data);
    io.emit(event, data);
  }
}