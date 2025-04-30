let io;
const db = require("../models");
const Student = db.student;
const StudentSession = db.studentSession;
const Session = db.session;

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
        socket.on('join-code', async ({ code, name, surname, albumNumber }) => {
        console.log(`Client ${socket.id} joined code room: ${code}, Name: ${name || 'N/A'}, Surname: ${surname || 'N/A'}, Album Number: ${albumNumber || 'N/A'}`);
        
        socket.join(`code-${code}`);
        
        socket.userData = { name, surname, albumNumber };
        
        try {
          const [student, created] = await Student.findOrCreate({
            where: { albumNumber: albumNumber },
            defaults: { name, surname }
          });
          
          if (!created && (student.name !== name || student.surname !== surname)) {
            await student.update({ name, surname });
          }
          
          const session = await Session.findOne({
            where: { sessionCode: code }
          });
          
          if (session) {
            const [studentSession, sessionCreated] = await StudentSession.findOrCreate({
              where: {
                studentId: student.id,
                sessionId: session.sessionId
              },
              defaults: {
                active: true,
                joinedAt: new Date()
              }
            });
            
            if (!sessionCreated) {
              await studentSession.update({ 
                active: true,
                joinedAt: new Date()
              });
            }
            
            socket.studentData = {
              studentId: student.id,
              sessionId: session.sessionId
            };
            
            console.log(`Student ${student.id} (${student.name} ${student.surname}) joined session ${session.sessionId}`);
          } else {
            console.log(`No session found with code: ${code}`);
          }
        } catch (error) {
          console.error('Error adding student to session:', error);
        }
        
        socket.emit('joined-code', { success: true, code, name, surname, albumNumber });
        
        if (socket.previousCode && socket.previousCode !== code) {
          socket.leave(`code-${socket.previousCode}`);
          console.log(`Client ${socket.id} left previous code room: ${socket.previousCode}`);
          
          if (socket.previousStudentData) {
            try {
              const { studentId, sessionId } = socket.previousStudentData;
              await StudentSession.update(
                { active: false },
                { 
                  where: { 
                    studentId: studentId,
                    sessionId: sessionId
                  }
                }
              );
              console.log(`Marked student ${studentId} as inactive in session ${sessionId}`);
            } catch (error) {
              console.error('Error updating student session status:', error);
            }
          }
        }
        
        socket.previousCode = code;
        socket.previousStudentData = socket.studentData;
      });
      
      socket.on('leave-code', async () => {
        if (socket.previousCode) {
          socket.leave(`code-${socket.previousCode}`);
          console.log(`Client ${socket.id} manually left code room: ${socket.previousCode}`);
          
          if (socket.previousStudentData) {
            try {
              const { studentId, sessionId } = socket.previousStudentData;
              await StudentSession.update(
                { active: false },
                { 
                  where: { 
                    studentId: studentId,
                    sessionId: sessionId 
                  }
                }
              );
              console.log(`Marked student ${studentId} as inactive in session ${sessionId}`);
            } catch (error) {
              console.error('Error updating student session status:', error);
            }
          }
          
          socket.previousCode = null;
          socket.previousStudentData = null;
          socket.studentData = null;
        }
      });
        socket.on('disconnect', async () => {
        console.log('A client disconnected', socket.id);
        
        const studentDataToUse = socket.studentData || socket.previousStudentData;
        
        if (studentDataToUse) {
          try {
            const { studentId, sessionId } = studentDataToUse;
            
            const result = await StudentSession.update(
              { active: false },
              { 
                where: { 
                  studentId: studentId,
                  sessionId: sessionId 
                }
              }
            );
            
            if (result[0] > 0) {
              const session = await Session.findByPk(sessionId);
              if (session) {
                io.to(`code-${session.sessionCode}`).emit('student-left', { 
                  studentId: studentId,
                  sessionId: sessionId
                });
                console.log(`Marked student ${studentId} as inactive in session ${sessionId} on disconnect and notified room`);
              }
            }
          } catch (error) {
            console.error('Error updating student session status on disconnect:', error);
          }
        }
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