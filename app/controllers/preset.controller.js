
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
exports.deleteDefaultPreset = async (req, res) => {
  try {
    const id = req.params.id;
    const preset = await Preset.findOne({ where: { id, isDefault: true } });

    if (!preset) {
      return res.status(404).json({ message: "Defaultowy preset nie istnieje." });
    }

    await preset.destroy();
    return res.status(200).json({ message: "Defaultowy preset został usunięty." });
  } catch (error) {
    console.error("Błąd usuwania defaultowego presetu:", error);
    return res.status(500).json({ message: "Wewnętrzny błąd serwera" });
  }
};

exports.createDefaultPreset = async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) {
      return res.status(400).json({ message: "Brakuje nazwy lub danych." });
    }

    const newPreset = await Preset.create({
      name,
      data,
      isDefault: true,
    });

    return res.status(201).json(newPreset);
  } catch (error) {
    console.error("Błąd tworzenia defaultowego presetu:", error);
    return res.status(500).json({ message: "Wewnętrzny błąd serwera" });
  }
};