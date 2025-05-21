
const db = require("../models");
const Preset = db.Preset;

exports.getDefaultPresets = async (req, res) => {
  try {
    const defaults = await Preset.findAll({
      where: { isDefault: true },
      order: [["createdAt", "ASC"]],
    });
    return res.status(200).json(defaults);
  } catch (error) {
    console.error("Błąd pobierania domyślnych presetów:", error);
    return res.status(500).json({ message: "Wewnętrzny błąd serwera" });
  }
};
