/**
 * WebSocket utility for handling real-time communications
 */
let io;

module.exports = {
  /**
   * Initialize the socket.io instance with the HTTP server
   * @param {Object} server - HTTP server instance
   */
  init: (server) => {
    io = require('socket.io')(server, {
      cors: {
       origin: ["http://localhost:8081", "http://localhost:3000"], // add your FE port
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true
      }
    });
      io.on('connection', (socket) => {
      console.log('A client connected', socket.id);
      
      // Join a room for specific session updates by code
      socket.on('join-code', (code) => {
        console.log(`Client ${socket.id} joined code room: ${code}`);
        socket.join(`code-${code}`);
        socket.emit('joined-code', { success: true, code });
        
        // Leave previous code rooms if specified
        if (socket.previousCode && socket.previousCode !== code) {
          socket.leave(`code-${socket.previousCode}`);
          console.log(`Client ${socket.id} left previous code room: ${socket.previousCode}`);
        }
        
        // Store the current code for future reference
        socket.previousCode = code;
      });
      
      // Join room for receiving all session updates
      socket.on('subscribe-all-sessions', () => {
        console.log(`Client ${socket.id} subscribed to all sessions`);
        socket.join('all-sessions');
        socket.emit('subscribed-all-sessions', { success: true });
      });
      
      // Unsubscribe from all session updates
      socket.on('unsubscribe-all-sessions', () => {
        console.log(`Client ${socket.id} unsubscribed from all sessions`);
        socket.leave('all-sessions');
        socket.emit('unsubscribed-all-sessions', { success: true });
      });
      
      socket.on('disconnect', () => {
        console.log('A client disconnected', socket.id);
      });
    });
    
    return io;
  },
  
  /**
   * Get the socket.io instance
   * @returns {Object} socket.io instance
   */
  getIO: () => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    return io;
  },
  /**
   * Emit a session update event to a specific room
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   * @param {string} room - Room name (e.g., 'code-ABC123' or 'session-1')
   */
  emitSessionUpdate: (event, data, room) => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    
    if (!room) {
      throw new Error('Room name is required for session updates');
    }
    
    console.log(`Emitting ${event} to room: ${room}`, data);
    // Send the original event
    io.to(room).emit(event, data);
    
    // Extract session code from room name
    const codeMatch = room.match(/^code-(\d+)$/);
    if (codeMatch && codeMatch[1]) {
      const sessionCode = parseInt(codeMatch[1]);
      // Also emit in the format the frontend expects (session-update-{code})
      io.to(room).emit(`session-update-${sessionCode}`, data);
    }
    
    // Also broadcast to the all-sessions room for global listeners
    if (room !== 'all-sessions' && event.includes('session')) {
      console.log(`Broadcasting ${event} to all-sessions room`);
      io.to('all-sessions').emit(event, {
        ...data,
        _meta: { source: room }
      });
    }
  },
  
  /**
   * Broadcast session update to all connected clients
   * @param {string} event - Event name
   * @param {Object} data - Data to send
   */
  broadcastSessionUpdate: (event, data) => {
    if (!io) {
      throw new Error('Socket.io not initialized');
    }
    
    console.log(`Broadcasting ${event} to all clients`, data);
    io.emit(event, data);
  }
}
