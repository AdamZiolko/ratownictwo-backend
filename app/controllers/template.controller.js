const db = require("../models");
const Template = db.template;

exports.createTemplate = async (req, res) => {
  try {
    if (!req.body.name || !req.body.tasks) {
      return res.status(400).send({ message: "Brak wymaganych pól: name, tasks" });
    }
    const template = await Template.create({
      name: req.body.name,
      tasks: req.body.tasks,
      userId: req.userId
    });
    
    console.log('Created template:', template);
    res.status(201).send(template);
  } catch (error) {
    console.error('Error details:', error);
    res.status(500).send({ message: error.message });
  }
};
  exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.findAll({
      where: { userId: req.userId }
    });
    res.status(200).send(templates);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }

};