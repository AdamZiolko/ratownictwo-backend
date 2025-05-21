const db = require("../models");
const Session = db.session;
const Student = db.student;
const StudentSession = db.studentSession;
const socketUtils = require("../utils/socket");

exports.create = (req, res) => {
  if (
    req.body.temperature === undefined ||
    req.body.rhythmType === undefined ||
    req.body.beatsPerMinute === undefined ||
    req.body.noiseLevel === undefined ||
    req.body.sessionCode === undefined ||
    req.body.name === undefined
  ) {

    res.status(400).send({
      message: "Content cannot be empty!"
    });
    return;
  }  
  
  const session = {
    userId: req.userId,  
    name: req.body.name,
    temperature: req.body.temperature,
    rhythmType: req.body.rhythmType,
    beatsPerMinute: req.body.beatsPerMinute,
    noiseLevel: req.body.noiseLevel,
    sessionCode: req.body.sessionCode,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    isEkdDisplayHidden: req.body.isEkdDisplayHidden !== undefined ? req.body.isEkdDisplayHidden : false,
    bp: req.body.bp,
    spo2: req.body.spo2,
    etco2: req.body.etco2,
    rr: req.body.rr
  };
  
  Session.create(session)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Session."
      });
    });
};

exports.findAll = async (req, res) => {
  const isExaminer = req.query.isExaminer === 'true';
  const syncConnected = req.query.syncConnected === 'true';
  
  try {
    const sessions = await Session.findAll({
      where: {
        userId: req.userId  
      },
      include: [{
        model: Student,
        through: {
          attributes: ['active', 'joinedAt'],
          where: { active: true }
        },
        attributes: ['id', 'name', 'surname', 'albumNumber'],
        required: false
      }]
    });
    
    if (isExaminer && syncConnected) {
      // Process each session to check for really connected students
      const sessionsWithRealConnections = await Promise.all(
        sessions.map(async (session) => {
          const sessionData = session.toJSON();
          
          try {
            // Sync the database with actual websocket connections
            const syncResult = await socketUtils.syncStudentSessionStatus(session.sessionCode);
            
            if (syncResult) {
              // Refresh the student list after syncing
              const refreshedStudents = await session.getStudents({
                through: { 
                  attributes: ['active', 'joinedAt'],
                  where: { active: true }
                },
                attributes: ['id', 'name', 'surname', 'albumNumber']
              });
              
              return {
                ...sessionData,
                students: refreshedStudents,
                hasConnectedStudents: refreshedStudents.length > 0,
                connectedStudentsCount: refreshedStudents.length,
                syncPerformed: true,
                ghostsRemoved: syncResult.ghostsRemoved
              };
            }
          } catch (syncError) {
            console.error(`Error syncing session ${session.sessionCode}:`, syncError);
          }
          
          // Fallback if sync failed
          return {
            ...sessionData,
            hasConnectedStudents: sessionData.students && sessionData.students.length > 0,
            connectedStudentsCount: sessionData.students ? sessionData.students.length : 0,
            syncPerformed: false
          };
        })
      );
      
      return res.send(sessionsWithRealConnections);
    } else if (isExaminer) {
      // Just add the connected flag without syncing
      const sessionsWithStudentInfo = sessions.map(session => {
        const sessionData = session.toJSON();
        const hasConnectedStudents = sessionData.students && sessionData.students.length > 0;
        
        return {
          ...sessionData,
          hasConnectedStudents,
          connectedStudentsCount: hasConnectedStudents ? sessionData.students.length : 0
        };
      });
      
      return res.send(sessionsWithStudentInfo);
    } else {
      return res.send(sessions);
    }
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving sessions."
    });
  }
};

exports.findOne = async (req, res) => {
  const id = req.params.id;
  const isExaminer = req.query.isExaminer === 'true';
  const syncConnected = req.query.syncConnected === 'true';
  
  try {
    const session = await Session.findOne({
      where: {
        sessionId: id,
        userId: req.userId  
      },
      include: [{
        model: Student,
        through: {
          attributes: ['active', 'joinedAt'],
          where: { active: true }
        },
        attributes: ['id', 'name', 'surname', 'albumNumber'],
        required: false
      }]
    });
    
    if (!session) {
      return res.status(404).send({
        message: `Cannot find Session with id=${id}.`
      });
    }
    
    if (isExaminer && syncConnected) {
      try {
        // Sync the database with actual websocket connections
        const syncResult = await socketUtils.syncStudentSessionStatus(session.sessionCode);
        
        if (syncResult) {
          // Refresh the student list after syncing
          const refreshedStudents = await session.getStudents({
            through: { 
              attributes: ['active', 'joinedAt'],
              where: { active: true }
            },
            attributes: ['id', 'name', 'surname', 'albumNumber']
          });
          
          const sessionData = session.toJSON();
          return res.send({
            ...sessionData,
            students: refreshedStudents,
            hasConnectedStudents: refreshedStudents.length > 0,
            connectedStudentsCount: refreshedStudents.length,
            syncPerformed: true,
            ghostsRemoved: syncResult.ghostsRemoved
          });
        }
      } catch (syncError) {
        console.error(`Error syncing session ${session.sessionCode}:`, syncError);
      }
    } else if (isExaminer) {
      const sessionData = session.toJSON();
      const hasConnectedStudents = sessionData.students && sessionData.students.length > 0;
      
      return res.send({
        ...sessionData,
        hasConnectedStudents,
        connectedStudentsCount: hasConnectedStudents ? sessionData.students.length : 0
      });
    }
    
    res.send(session);
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Session with id=" + id
    });
  }
};

exports.update = (req, res) => {
  const sessionId = req.params.id; 
  
  Session.update(req.body, {
    where: { 
      sessionId: sessionId,
      userId: req.userId  
    }
  })
    .then(num => {
      if (num == 1) {
        Session.findByPk(sessionId).then(updatedSession => {
          if (req.body.isActive === false) {
            socketUtils.emitSessionDeleted(updatedSession.sessionCode);
          } else {
            socketUtils.emitSessionUpdate('session-updated', updatedSession, `code-${updatedSession.sessionCode}`);
          }
        });

        res.send({
          message: "Session was updated successfully."
        });
      } else {
        res.send({
          message: `Cannot update Session with id=${sessionId}. Maybe Session was not found or req.body is empty!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error updating Session with id=" + sessionId
      });
    });
};

exports.delete = (req, res) => {
  const id = req.params.id;

  Session.findOne({
    where: {
      sessionId: id,
      userId: req.userId 
    }
  })
    .then(session => {
      if (!session) {
        res.send({
          message: `Cannot delete Session with id=${id}. Maybe Session was not found or you don't have permission!`
        });
        return;
      }
      
      // Store the session code before deleting
      const sessionCode = session.sessionCode;

      Session.destroy({
        where: { 
          sessionId: id,
          userId: req.userId 
        }
      })
        .then(num => {
          if (num == 1) {
            // Notify all connected students that the session has been deleted
            socketUtils.emitSessionDeleted(sessionCode);
            
            res.send({
              message: "Session was deleted successfully!"
            });
          } else {
            res.send({
              message: `Cannot delete Session with id=${id}. Maybe Session was not found!`
            });
          }
        })
        .catch(err => {
          res.status(500).send({
            message: err.message + id
          });
        });
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving Session before delete with id=" + id
      });
    });
};

exports.deleteAll = (req, res) => {
  Session.destroy({
    where: {},
    truncate: false
  })
    .then(nums => {
      res.send({ message: `${nums} Sessions were deleted successfully!` });
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while removing all sessions."
      });
    });
};

exports.findByCode = async (req, res) => {
  const code = req.params.code;
  const isExaminer = req.query.isExaminer === 'true';
  const syncConnected = req.query.syncConnected === 'true';
  
  try {
    let whereClause = { sessionCode: code };
    
    // For non-examiners (students), only allow access to active sessions
    if (!isExaminer) {
      whereClause.isActive = true;
    } else if (req.userId) {
      // For examiners, only show their own sessions
      whereClause.userId = req.userId;
    }

    const data = await Session.findOne({
      where: whereClause,
      include: [{
        model: Student,
        through: {
          attributes: ['active', 'joinedAt'],
          where: { active: true }
        },
        attributes: ['id', 'name', 'surname', 'albumNumber'],
        required: false
      }]
    });
    
    if (!data) {
      return res.status(404).send({
        message: `No sessions found with code=${code}.`
      });
    }
    
    const objectToReturn = {
      sessionId: data.sessionId,
      name: data.name,
      temperature: data.temperature,
      rhythmType: data.rhythmType,
      beatsPerMinute: data.beatsPerMinute,
      noiseLevel: data.noiseLevel,
      sessionCode: data.sessionCode,
      isActive: data.isActive,
      isEkdDisplayHidden: data.isEkdDisplayHidden,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      bp: data.bp,
      spo2: data.spo2,
      etco2: data.etco2,
      rr: data.rr,
      students: data.students || []
    };
    
    if (isExaminer && syncConnected) {
      try {
        // Sync the database with actual websocket connections
        const syncResult = await socketUtils.syncStudentSessionStatus(code);
        
        if (syncResult) {
          // Refresh the student list after syncing
          const refreshedStudents = await data.getStudents({
            through: { 
              attributes: ['active', 'joinedAt'],
              where: { active: true }
            },
            attributes: ['id', 'name', 'surname', 'albumNumber']
          });
          
          objectToReturn.students = refreshedStudents;
          objectToReturn.hasConnectedStudents = refreshedStudents.length > 0;
          objectToReturn.connectedStudentsCount = refreshedStudents.length;
          objectToReturn.syncPerformed = true;
          objectToReturn.ghostsRemoved = syncResult.ghostsRemoved;
        }
      } catch (syncError) {
        console.error(`Error syncing session ${code}:`, syncError);
      }
    } else if (isExaminer) {
      const hasConnectedStudents = objectToReturn.students && objectToReturn.students.length > 0;
      objectToReturn.hasConnectedStudents = hasConnectedStudents;
      objectToReturn.connectedStudentsCount = hasConnectedStudents ? objectToReturn.students.length : 0;
    }
    
    return res.send(objectToReturn);
  } catch (err) {
    res.status(500).send({
      message: `Error retrieving sessions with code=${code}: ${err.message}`
    });
  }
};

exports.validateCode = (req, res) => {
  const code = req.params.code;

  Session.findOne({
    where: {
      sessionCode: code,
      isActive: true
    }
  })
    .then(data => {
      res.send({
        valid: data !== null
      });
    })
    .catch(err => {
      res.status(500).send({
        message: `Error validating session code=${code}: ${err.message}`
      });
    });
};

exports.getSessionStudents = async (req, res) => {
  const sessionId = req.params.sessionId;
  const syncConnected = req.query.syncConnected === 'true';
  
  try {
    const session = await Session.findOne({
      where: {
        sessionId: sessionId,
        userId: req.userId 
      }
    });
    
    if (!session) {
      return res.status(404).send({
        message: `Session with id=${sessionId} not found or you don't have permission.`
      });
    }

    if (syncConnected) {
      try {
        // Sync the database with actual websocket connections
        await socketUtils.syncStudentSessionStatus(session.sessionCode);
      } catch (syncError) {
        console.error(`Error syncing session ${session.sessionCode}:`, syncError);
      }
    }

    const data = await StudentSession.findAll({
      where: { 
        sessionId: sessionId,
        active: true
      },
      include: [{
        model: Student,
        attributes: ['id', 'name', 'surname', 'albumNumber']
      }]
    });
    
    const students = data.map(item => item.Student);
    res.send(students);
  } catch (err) {
    res.status(500).send({
      message: `Error retrieving students for session with id=${sessionId}: ${err.message}`
    });
  }
};

exports.getSessionStudentsByCode = async (req, res) => {
  const code = req.params.code;
  const isExaminer = req.query.isExaminer === 'true';
  const syncConnected = req.query.syncConnected === 'true';
  
  try {
    let whereClause = { sessionCode: code };
    
    // For non-examiners (students), only allow access to active sessions
    if (!isExaminer) {
      whereClause.isActive = true;
    } else if (req.userId) {
      // For examiners, only show their own sessions
      whereClause.userId = req.userId;
    }
  
    const session = await Session.findOne({
      where: whereClause
    });

    if (!session) {
      return res.status(404).send({
        message: `Session with code=${code} not found${!isExaminer ? " or not active" : ""}.`
      });
    }

    if (isExaminer && syncConnected) {
      try {
        const syncResult = await socketUtils.syncStudentSessionStatus(code);
        
        if (syncResult) {
          console.log(`Synced session ${code}, removed ${syncResult.ghostsRemoved} ghost students`);
        }
      } catch (syncError) {
        console.error(`Error syncing session ${code}:`, syncError);
      }
    }
    
    const students = await session.getStudents({
      through: {
        where: { active: true }
      }
    });
    
    const response = isExaminer ? {
      sessionId: session.sessionId,
      sessionCode: code,
      students: students,
      hasConnectedStudents: students.length > 0,
      connectedStudentsCount: students.length,
      isActive: session.isActive,
      isEkdDisplayHidden: session.isEkdDisplayHidden
    } : students;
    
    res.send(response);
  } catch (err) {
    res.status(500).send({
      message: `Error retrieving students for session with code=${code}: ${err.message}`
    });
  }
};

exports.removeStudentFromSession = (req, res) => {
  const sessionId = req.params.sessionId;
  const studentId = req.params.studentId;
  
  Session.findOne({
    where: {
      sessionId: sessionId,
      userId: req.userId
    }
  })
  .then(session => {
    if (!session) {
      return res.status(403).send({
        message: "You don't have permission to modify this session."
      });
    }
    
    return StudentSession.update(
      { active: false },
      { 
        where: { 
          sessionId: sessionId,
          studentId: studentId 
        }
      }
    )
    .then(num => {
      if (num == 1) {
        Session.findByPk(sessionId)
          .then(session => {
            if (session) {
              socketUtils.emitSessionUpdate('student-left', { studentId }, `code-${session.sessionCode}`);
            }
          });
          
        res.send({
          message: "Student was removed from session successfully."
        });
      } else {
        res.send({
          message: `Cannot remove student with id=${studentId} from session with id=${sessionId}. Maybe relationship was not found!`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: `Error removing student with id=${studentId} from session with id=${sessionId}: ${err.message}`
      });
    });
  })
  .catch(err => {
    res.status(500).send({
      message: `Error checking session permissions: ${err.message}`
    });
  });
};

exports.syncAllSessions = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(403).send({
        message: "Unauthorized"
      });
    }

    // Check if user has the required role (admin/examiner)
    const user = await db.user.findByPk(req.userId);
    if (!user) {
      return res.status(403).send({
        message: "User not found"
      });
    }

    const userRoles = await user.getRoles();
    const roles = userRoles.map(role => role.name);
    if (!roles.includes("admin") && !roles.includes("examiner")) {
      return res.status(403).send({
        message: "Requires admin or examiner role"
      });
    }

    // Get all active sessions
    const activeSessions = await Session.findAll({
      where: { isActive: true },
      attributes: ['sessionId', 'sessionCode']
    });
    
    if (activeSessions.length === 0) {
      return res.send({
        message: "No active sessions found",
        syncedSessions: 0,
        ghostsRemoved: 0
      });
    }
    
    let totalGhostsRemoved = 0;
    let syncedSessions = 0;
    
    // Process each active session
    for (const session of activeSessions) {
      try {
        const syncResult = await socketUtils.syncStudentSessionStatus(session.sessionCode);
        if (syncResult) {
          syncedSessions++;
          if (syncResult.ghostsRemoved > 0) {
            totalGhostsRemoved += syncResult.ghostsRemoved;
          }
        }
      } catch (err) {
        console.error(`Error syncing session ${session.sessionCode}:`, err);
      }
    }
    
    return res.send({
      message: `Successfully synced ${syncedSessions} sessions`,
      syncedSessions,
      ghostsRemoved: totalGhostsRemoved
    });
  } catch (err) {
    console.error("Error syncing all sessions:", err);
    res.status(500).send({
      message: `Error syncing sessions: ${err.message}`
    });
  }
};