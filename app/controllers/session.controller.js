const db = require("../models");
const Session = db.session;
const socketUtils = require("../utils/socket");

// Create and Save a new Session
exports.create = (req, res) => {
  // Validate request
  if (
    req.body.temperature === undefined || 
    req.body.rhythmType === undefined || 
    req.body.beatsPerMinute === undefined || 
    req.body.noiseLevel === undefined || 
    req.body.sessionCode === undefined
  ) {

      console.log("Request body:", req.body); // Log the request body for debugging

    res.status(400).send({
      message: "Content cannot be empty!"
    });
    return;
  }

  // Create a Session
  const session = {
    temperature: req.body.temperature,
    rhythmType: req.body.rhythmType,
    beatsPerMinute: req.body.beatsPerMinute,
    noiseLevel: req.body.noiseLevel,
    sessionCode: req.body.sessionCode
  };  // Save Session in the database
  Session.create(session)
    .then(data => {
      // Emit WebSocket event to the specific code room after successful creation
      socketUtils.emitSessionUpdate('session-created', data, `code-${data.sessionCode}`);
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while creating the Session."
      });
    });
};

// Retrieve all Sessions from the database
exports.findAll = (req, res) => {
  Session.findAll()
    .then(data => {
      // Emit to global sessions room for subscribers interested in all sessions
      socketUtils.emitSessionUpdate('sessions-list-accessed', data, 'all-sessions');
      res.send(data);
    })
    .catch(err => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving sessions."
      });
    });
};

// Find a single Session with an id
exports.findOne = (req, res) => {
  const id = req.params.id;

  Session.findByPk(id)
    .then(data => {
      if (data) {
        // Emit WebSocket event for this specific session
        socketUtils.emitSessionUpdate('session-accessed', data, `code-${data.sessionCode}`);
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

// Update a Session by the id in the request
exports.update = (req, res) => {
  const sessionId = req.params.id;  Session.update(req.body, {
    where: { sessionId: sessionId }
  })
    .then(num => {
      if (num == 1) {
        // After successful update, fetch the updated session to send via WebSockets
        Session.findByPk(sessionId).then(updatedSession => {
          // Emit WebSocket event only to the specific code room
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

// Delete a Session with the specified id in the request
exports.delete = (req, res) => {
  const id = req.params.id;

  // First, get the session before deleting it to have its data for the WebSocket event
  Session.findByPk(id)
    .then(session => {
      if (!session) {
        res.send({
          message: `Cannot delete Session with id=${id}. Maybe Session was not found!`
        });
        return;
      }
      
      // Now delete the session
      Session.destroy({
        where: { sessionId: id }
      })
        .then(num => {
          if (num == 1) {
            // Emit full session data for better client-side handling
            socketUtils.emitSessionUpdate('session-deleted', { 
              sessionId: id, 
              sessionCode: session.sessionCode,
              temperature: session.temperature,
              rhythmType: session.rhythmType,
              beatsPerMinute: session.beatsPerMinute,
              noiseLevel: session.noiseLevel
            }, `code-${session.sessionCode}`);
            
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

// Delete all Sessions from the database.
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
  
  Session.findAll({
    where: { sessionCode: code }
  })
    .then(data => {
      if (data.length > 0) {
        // Instead of sending an array, create a single object with all the sessions
        const objectToReturn = {
          temperature: data[0].temperature,
          rhythmType: data[0].rhythmType,
          beatsPerMinute: data[0].beatsPerMinute,
          noiseLevel: data[0].noiseLevel,
          sessionCode: data[0].sessionCode
        };

        // Emit WebSocket event to notify clients of session access
        socketUtils.emitSessionUpdate('session-fetched', objectToReturn, `code-${code}`);
        
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

// Validate if a session code exists
exports.validateCode = (req, res) => {
  const code = req.params.code;
  
  Session.findOne({
    where: { sessionCode: code }
  })
    .then(data => {
      // Return true if session code exists, false otherwise
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