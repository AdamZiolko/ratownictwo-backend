let io;
const db = require("../models");
const Student = db.student;
const StudentSession = db.studentSession;
const Session = db.session;
const User = db.user;
const Role = db.role;

module.exports = {
  init: (server) => {
    io = require("socket.io")(server, {
      cors: {
        // origin: ["http://localhost:8081", "http://localhost:3000"],
        origin: [ 
        "http://localhost:8081",
        `http://192.168.1.111:8081`,     
        `exp://192.168.1.111:8081`,      
        "exp+ratownictwo://*"
      ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
      },
    });
    
    setInterval(async () => {
      try {
        console.log("Running automatic ghost student cleanup...");
        
        const activeSessions = await Session.findAll({
          where: { isActive: true },
          attributes: ['sessionId', 'sessionCode']
        });
        
        if (activeSessions.length === 0) {
          console.log("No active sessions found for cleanup");
          return;
        }
        
        let totalGhostsRemoved = 0;
        
        for (const session of activeSessions) {
          try {
            const syncResult = await module.exports.syncStudentSessionStatus(session.sessionCode);
            if (syncResult && syncResult.ghostsRemoved > 0) {
              totalGhostsRemoved += syncResult.ghostsRemoved;
              console.log(`Removed ${syncResult.ghostsRemoved} ghost students from session ${session.sessionCode}`);
            }
          } catch (err) {
            console.error(`Error cleaning up session ${session.sessionCode}:`, err);
          }
        }
        
        console.log(`Automatic cleanup complete. Total ghosts removed: ${totalGhostsRemoved}`);
      } catch (err) {
        console.error("Error in automatic ghost student cleanup:", err);
      }
    }, 5 * 60 * 1000); 
    
    io.on("connection", (socket) => {
      console.log("A client connected", socket.id);

      socket.on(
        "examiner-subscribe",
        async ({ sessionCode, userId, token }) => {
          console.log(
            `Examiner ${userId} subscribing to session: ${sessionCode}`
          );

          try {
            socket.join(`examiner-${sessionCode}`);
            socket.examinerData = { sessionCode, userId };

            const session = await Session.findOne({
              where: { sessionCode },
            });

            if (session) {
              const students = await session.getStudents({
                through: { where: { active: true } },
              });

              socket.emit("student-list-update", {
                sessionId: session.sessionId,
                sessionCode,
                isEkdDisplayHidden: session.isEkdDisplayHidden,
                students: students.map((s) => ({
                  id: s.id,
                  name: s.name,
                  surname: s.surname,
                  albumNumber: s.albumNumber,
                })),
              });

              console.log(
                `Sent initial student list to examiner for session ${sessionCode}`
              );
            }
          } catch (error) {
            console.error("Error in examiner subscription:", error);
            socket.emit("examiner-subscribe-error", {
              message: "Failed to subscribe to session updates",
            });
          }
        }
      );

      socket.on("audio-command", ({ code, command, soundName, loop }) => {
      console.log(`Audio cmd for ${code}:`, { command, soundName, loop });
      io.to(`code-${code}`).emit("audio-command", { command, soundName, loop });
      });

      socket.on('student-audio-command', ({ studentId, command, soundName, loop }) => {
      console.log(`🎧 Indywidualna komenda dla studenta ${studentId}:`, { command, soundName, loop });
      io.to(`student-${studentId}`).emit('audio-command', { command, soundName, loop });
      });

      socket.on("examiner-unsubscribe", () => {
        if (socket.examinerData && socket.examinerData.sessionCode) {
          socket.leave(`examiner-${socket.examinerData.sessionCode}`);
          console.log(
            `Examiner unsubscribed from session: ${socket.examinerData.sessionCode}`
          );
          socket.examinerData = null;
        }
      });

      socket.on("join-code", async ({ code, name, surname, albumNumber }) => {

        console.log(
          `Client ${socket.id} joined code room: ${code}, Name: ${
            name || "N/A"
          }, Surname: ${surname || "N/A"}, Album Number: ${
            albumNumber || "N/A"
          }`
        );

        socket.userData = { name, surname, albumNumber };
        try {
          const [student, created] = await Student.findOrCreate({
            where: { albumNumber: albumNumber },
            defaults: { name, surname },
          });

          if (
            !created &&
            (student.name !== name || student.surname !== surname)
          ) {
            await student.update({ name, surname });
          }

          const session = await Session.findOne({
            where: { 
              sessionCode: code,
              isActive: true 
            },
          });

          if (!session) {
            console.log(`Student couldn't join: Session ${code} not found or not active`);
            socket.emit("joined-code", {
              success: false,
              code,
              message: "Session not found or not active"
            });
            return;
          }

          socket.join(`code-${code}`);
          
          const [studentSession, sessionCreated] =
            await StudentSession.findOrCreate({
              where: {
                studentId: student.id,
                sessionId: session.sessionId,
              },
              defaults: {
                active: true,
                joinedAt: new Date(),
              },
            });

          if (!sessionCreated) {
            await studentSession.update({
              active: true,
              joinedAt: new Date(),
            });
          }

          socket.join(`student-${student.id}`); 
          console.log(`Student ${student.id} dołączył do swojego pokoju`);

          socket.studentData = {
            studentId: student.id,
            sessionId: session.sessionId,
          };

          console.log(
            `Student ${student.id} (${student.name} ${student.surname}) joined session ${session.sessionId}`
          );

          const studentInfo = {
            id: student.id,
            name: student.name,
            surname: student.surname,
            albumNumber: student.albumNumber,
          };

          module.exports.emitExaminerUpdate(
            session.sessionId,
            "join",
            studentInfo
          );
          
          socket.emit("joined-code", {
            success: true,
            code,
            name,
            surname,
            albumNumber,
            isEkdDisplayHidden: session.isEkdDisplayHidden
          });

        } catch (error) {
          console.error("Error adding student to session:", error);
          socket.emit("joined-code", {
            success: false,
            code,
            message: "Error joining session"
          });
        }

        if (socket.previousCode && socket.previousCode !== code) {
          socket.leave(`code-${socket.previousCode}`);
          console.log(
            `Client ${socket.id} left previous code room: ${socket.previousCode}`
          );

          if (socket.previousStudentData) {
            try {
              const { studentId, sessionId } = socket.previousStudentData;
              await StudentSession.update(
                { active: false },
                {
                  where: {
                    studentId: studentId,
                    sessionId: sessionId,
                  },
                }
              );
              console.log(
                `Marked student ${studentId} as inactive in session ${sessionId}`
              );
            } catch (error) {
              console.error("Error updating student session status:", error);
            }
          }
        }

        socket.previousCode = code;
        socket.previousStudentData = socket.studentData;
      });
      socket.on("leave-code", async () => {
        if (socket.previousCode) {
          socket.leave(`code-${socket.previousCode}`);

          if (socket.previousStudentData) {
            try {
              const { studentId, sessionId } = socket.previousStudentData;
              await StudentSession.update(
                { active: false },
                {
                  where: {
                    studentId: studentId,
                    sessionId: sessionId,
                  },
                }
              );

              const student = await Student.findByPk(studentId);
              if (student) {
                const studentInfo = {
                  id: student.id,
                  name: student.name,
                  surname: student.surname,
                  albumNumber: student.albumNumber,
                };

                module.exports.emitExaminerUpdate(
                  sessionId,
                  "leave",
                  studentInfo
                );
              }
            } catch (error) {
              console.error("Error updating student session status:", error);
            }
          }

          socket.previousCode = null;
          socket.previousStudentData = null;
          socket.studentData = null;
        }
      });
      socket.on("disconnect", async () => {
        console.log("A client disconnected", socket.id);

        if (socket.examinerData) {
          socket.leave(`examiner-${socket.examinerData.sessionCode}`);
          console.log(
            `Examiner disconnected from session: ${socket.examinerData.sessionCode}`
          );
        }

        const studentDataToUse =
          socket.studentData || socket.previousStudentData;

        if (studentDataToUse) {
          try {
            const { studentId, sessionId } = studentDataToUse;

            const result = await StudentSession.update(
              { active: false },
              {
                where: {
                  studentId: studentId,
                  sessionId: sessionId,
                },
              }
            );

            if (result[0] > 0) {
              const session = await Session.findByPk(sessionId);
              if (session) {
                io.to(`code-${session.sessionCode}`).emit("student-left", {
                  studentId: studentId,
                  sessionId: sessionId,
                });

                const student = await Student.findByPk(studentId);
                if (student) {
                  const studentInfo = {
                    id: student.id,
                    name: student.name,
                    surname: student.surname,
                    albumNumber: student.albumNumber,
                  };

                  module.exports.emitExaminerUpdate(
                    sessionId,
                    "leave",
                    studentInfo
                  );
                }

                console.log(
                  `Marked student ${studentId} as inactive in session ${sessionId} on disconnect and notified all subscribers`
                );
              }
            }
          } catch (error) {
            console.error(
              "Error updating student session status on disconnect:",
              error
            );
          }
        }
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }
    return io;
  },
  emitSessionUpdate: (event, data, room) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    if (!room) {
      throw new Error("Room name is required for session updates");
    }

    io.to(room).emit(event, data);
    const codeMatch = room.match(/^code-(.+)$/);
    if (codeMatch && codeMatch[1]) {
      const sessionCode = codeMatch[1];
      io.to(room).emit(`session-update-${sessionCode}`, data);
    }
  },

  emitExaminerUpdate: async (sessionId, eventType, studentData) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    try {
      const session = await Session.findByPk(sessionId);
      if (!session) {
        console.error(`Cannot find session with id=${sessionId}`);
        return;
      }

      const updateData = {
        type: eventType, 
        sessionId: sessionId,
        sessionCode: session.sessionCode,
        student: studentData,
        timestamp: new Date(),
      };

      io.to(`examiner-${session.sessionCode}`).emit(
        "student-session-update",
        updateData
      );

      console.log(
        `Emitted examiner update for session ${sessionId}, event: ${eventType}`
      );
    } catch (error) {
      console.error("Error emitting examiner update:", error);
    }
  },

  broadcastSessionUpdate: (event, data) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    console.log(`Broadcasting ${event} to all clients`, data);
    io.emit(event, data);
  },

  sendStudentListToExaminer: async (sessionId, socketId) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    try {
      const session = await Session.findByPk(sessionId);
      if (!session) {
        console.error(`Cannot find session with id=${sessionId}`);
        return;
      }

      const students = await session.getStudents({
        through: { where: { active: true } },
      });

      const studentList = students.map((s) => ({
        id: s.id,
        name: s.name,
        surname: s.surname,
        albumNumber: s.albumNumber,
      }));

      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("student-list-update", {
          sessionId: session.sessionId,
          sessionCode: session.sessionCode,
          isEkdDisplayHidden: session.isEkdDisplayHidden,
          students: studentList,
        });
        console.log(
          `Sent updated student list to examiner for session ${session.sessionCode}`
        );
      }
    } catch (error) {
      console.error("Error sending student list to examiner:", error);
    }
  },

  getConnectedStudentsForSession: async (sessionCode) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    try {
      // Get all sockets in the specific session room
      const sockets = await io.in(`code-${sessionCode}`).fetchSockets();
      
      const connectedStudents = sockets
        .filter(socket => socket.studentData) // Filter only student sockets (not examiners)
        .map(socket => socket.studentData.studentId);
      
      return connectedStudents;
    } catch (error) {
      console.error(`Error getting connected students for session ${sessionCode}:`, error);
      return [];
    }
  },
  
  syncStudentSessionStatus: async (sessionCode) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    try {
      const session = await Session.findOne({
        where: { sessionCode }
      });

      if (!session) {
        console.error(`Cannot find session with code=${sessionCode}`);
        return;
      }

      // Get actually connected student IDs via websockets
      const connectedStudentIds = await module.exports.getConnectedStudentsForSession(sessionCode);
      
      // Get all students marked as active in the database
      const activeDbStudents = await session.getStudents({
        through: { where: { active: true } }
      });
      
      // Find ghost students (in DB as active but not connected via socket)
      const ghostStudentIds = activeDbStudents
        .filter(student => !connectedStudentIds.includes(student.id))
        .map(student => student.id);
      
      // Update ghost students to inactive
      if (ghostStudentIds.length > 0) {
        await StudentSession.update(
          { active: false },
          {
            where: {
              sessionId: session.sessionId,
              studentId: ghostStudentIds,
              active: true
            }
          }
        );
        
        console.log(`Marked ${ghostStudentIds.length} ghost students as inactive in session ${sessionCode}`);
      }
      
      return {
        sessionId: session.sessionId,
        connectedStudentIds,
        totalActive: connectedStudentIds.length,
        ghostsRemoved: ghostStudentIds.length
      };
    } catch (error) {
      console.error(`Error syncing student session status for ${sessionCode}:`, error);
      return null;
    }
  },

  emitSessionDeleted: async (sessionCode) => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }

    try {
      console.log(`Emitting session-deleted event for session code ${sessionCode}`);
      
      // Send session-deleted event to all clients in the session room
      io.to(`code-${sessionCode}`).emit('session-deleted', {});
      
      // Disconnect all students from the session room
      const sockets = await io.in(`code-${sessionCode}`).fetchSockets();
      for (const socket of sockets) {
        if (socket.studentData) {
          try {
            const { studentId, sessionId } = socket.studentData;
            await StudentSession.update(
              { active: false },
              {
                where: {
                  studentId,
                  sessionId,
                }
              }
            );
            console.log(`Marked student ${studentId} as inactive in deleted/deactivated session ${sessionId}`);
          } catch (error) {
            console.error("Error updating student session status on deletion:", error);
          }
        }
      }
    } catch (error) {
      console.error(`Error emitting session-deleted event for ${sessionCode}:`, error);
    }
  },
};
