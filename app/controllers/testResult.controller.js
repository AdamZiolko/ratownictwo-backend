const db = require("../models");
const TestResult = db.testResult;

exports.createTestResult = async (req, res) => {
  try {
    const testResult = await TestResult.create({
      student: req.body.student,
      tasks: req.body.tasks,
      comments: req.body.comments,
      userId: req.userId,
      sessionId: req.body.sessionId
    });
    
    res.status(201).send(testResult);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
  };
  exports.getAllTestResults = async (req, res) => {
  try {
    const results = await TestResult.findAll({
      where: { userId: req.userId }
    });
    res.status(200).send(results);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }

};