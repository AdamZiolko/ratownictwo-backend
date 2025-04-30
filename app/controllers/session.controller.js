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
  }  const session = {
    userId: req.userId,  
    name: req.body.name,
    temperature: req.body.temperature,
    rhythmType: req.body.rhythmType,
    beatsPerMinute: req.body.beatsPerMinute,
    noiseLevel: req.body.noiseLevel,
    sessionCode: req.body.sessionCode,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
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

exports.findAll = (req, res) => {
  Session.findAll({
    where: {
      userId: req.userId  
    },
    include: [{
      model: Student,
      through: {
        attributes: ['active', 'joinedAt'],
        where: { active: true }
      },
      attributes: ['id', 'name', 'surname', 'albumNumber']
    }]
  })
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving sessions."
      });
    });
};

exports.findOne = (req, res) => {
  const id = req.params.id;

  Session.findOne({
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
      attributes: ['id', 'name', 'surname', 'albumNumber']
    }]
  })
    .then(data => {
      if (data) {
        res.send(data);
      } else {
        res.status(404).send({
          message: `Cannot find Session with id=${id}.`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: "Error retrieving Session with id=" + id
      });
    });
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
          socketUtils.emitSessionUpdate('session-updated', updatedSession, `code-${updatedSession.sessionCode}`);
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

      Session.destroy({
        where: { 
          sessionId: id,
          userId: req.userId 
        }
      })
        .then(num => {
          if (num == 1) {
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

exports.findByCode = (req, res) => {
  const code = req.params.code;

  const whereClause = req.userId ? 
    { sessionCode: code, userId: req.userId } : 
    { sessionCode: code };

  Session.findOne({
    where: whereClause,
    include: [{
      model: Student,
      through: {
        attributes: ['active', 'joinedAt'],
        where: { active: true }
      },
      attributes: ['id', 'name', 'surname', 'albumNumber']
    }]
  })
    .then(data => {
      if (data) {
        const objectToReturn = {
          sessionId: data.sessionId,
          name: data.name,
          temperature: data.temperature,
          rhythmType: data.rhythmType,
          beatsPerMinute: data.beatsPerMinute,
          noiseLevel: data.noiseLevel,
          sessionCode: data.sessionCode,
          isActive: data.isActive,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          bp: data.bp,
          spo2: data.spo2,
          etco2: data.etco2,
          rr: data.rr,
          students: data.students || []
        };

        res.send(objectToReturn);
      } else {
        res.status(404).send({
          message: `No sessions found with code=${code}.`
        });
      }
    })
    .catch(err => {
      res.status(500).send({
        message: `Error retrieving sessions with code=${code}: ${err.message}`
      });
    });
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

exports.getSessionStudents = (req, res) => {
  const sessionId = req.params.sessionId;
  
  Session.findOne({
    where: {
      sessionId: sessionId,
      userId: req.userId 
    }
  })
    .then(session => {
      if (!session) {
        res.status(404).send({
          message: `Session with id=${sessionId} not found or you don't have permission.`
        });
        return;
      }

      StudentSession.findAll({
        where: { 
          sessionId: sessionId,
          active: true
        },
        include: [{
          model: Student,
          attributes: ['id', 'name', 'surname', 'albumNumber']
        }]
      })
      .then(data => {
        const students = data.map(item => item.Student);
        res.send(students);
      })
      .catch(err => {
        res.status(500).send({
          message: `Error retrieving students for session with id=${sessionId}: ${err.message}`
        });
      });
    })
    .catch(err => {
      res.status(500).send({
        message: `Error retrieving session with id=${sessionId}: ${err.message}`
      });
    });
};

// Get all students for a session by session code
exports.getSessionStudentsByCode = (req, res) => {
  const code = req.params.code;
  
  // Create a where clause - if this is an authenticated user with userId
  // require that the session belongs to them, otherwise just filter by code
  const whereClause = req.userId ? 
    { sessionCode: code, userId: req.userId } : 
    { sessionCode: code };
  
  Session.findOne({
    where: whereClause
  })
    .then(session => {
      if (!session) {
        res.status(404).send({
          message: `Session with code=${code} not found.`
        });
        return;
      }

      session.getStudents({
        through: {
          where: { active: true }
        }
      })
      .then(students => {
        res.send(students);
      })
      .catch(err => {
        res.status(500).send({
          message: `Error retrieving students for session with code=${code}: ${err.message}`
        });
      });
    })
    .catch(err => {
      res.status(500).send({
        message: `Error finding session with code=${code}: ${err.message}`
      });
    });
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
  }
  )
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
};