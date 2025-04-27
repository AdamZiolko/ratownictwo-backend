const db = require("../models");
const Session = db.session;
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
    name: req.body.name,
    temperature: req.body.temperature,
    rhythmType: req.body.rhythmType,
    beatsPerMinute: req.body.beatsPerMinute,
    noiseLevel: req.body.noiseLevel,
    sessionCode: req.body.sessionCode,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    hr: req.body.hr,
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
  Session.findAll()
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

  Session.findByPk(id)
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
  const sessionId = req.params.id; Session.update(req.body, {
    where: { sessionId: sessionId }
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

  Session.findByPk(id)
    .then(session => {
      if (!session) {
        res.send({
          message: `Cannot delete Session with id=${id}. Maybe Session was not found!`
        });
        return;
      }

      Session.destroy({
        where: { sessionId: id }
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

  Session.findAll({
    where: { sessionCode: code }
  })
    .then(data => {
      if (data.length > 0) {
        const objectToReturn = {
          name: data[0].name,
          temperature: data[0].temperature,
          rhythmType: data[0].rhythmType,
          beatsPerMinute: data[0].beatsPerMinute,
          noiseLevel: data[0].noiseLevel,
          sessionCode: data[0].sessionCode,
          isActive: data[0].isActive,
          createdAt: data[0].createdAt,
          updatedAt: data[0].updatedAt,
          hr: data[0].hr,
          bp: data[0].bp,
          spo2: data[0].spo2,
          etco2: data[0].etco2,
          rr: data[0].rr
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