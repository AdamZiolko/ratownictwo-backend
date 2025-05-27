const db = require("../models");
const Template = db.template;

exports.createOrUpdateTemplate = async (req, res) => {
  try {
    const { name, tasks } = req.body;
    if (!name || !tasks) {
      return res.status(400).send({ message: "Brak wymaganych pól: name, tasks" });
    }

    const userId = req.userId;
    let existing = await Template.findOne({ where: { userId, name } });

    if (existing) {
      existing.tasks = tasks;
      await existing.save();
      console.log("Zaktualizowano szablon:", existing);
      return res.status(200).send(existing);
    } else {
      const template = await Template.create({
        name,
        tasks,
        userId
      });
      console.log("Utworzono szablon:", template);
      return res.status(201).send(template);
    }
  } catch (error) {
    console.error("Error details:", error);
    return res.status(500).send({ message: error.message });
  }
};

exports.getAllTemplates = async (req, res) => {
  try {
    const userId = req.userId;
    const templates = await Template.findAll({
      where: { userId }
    });
    return res.status(200).send(templates);
  } catch (error) {
    console.error("Error details:", error);
    return res.status(500).send({ message: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const userId = req.userId;
    const id = req.params.id;

    const deletedCount = await Template.destroy({
      where: { id, userId }
    });

    if (deletedCount === 0) {
      return res.status(404).send({ message: "Szablon nie znaleziony lub brak uprawnień" });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("Error details:", error);
    return res.status(500).send({ message: error.message });
  }
};
