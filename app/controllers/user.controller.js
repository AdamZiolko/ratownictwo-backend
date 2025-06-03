// app/controllers/user.controller.js

const db = require("../models");
const User = db.user;
const Role = db.role;

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "username", "email"],
      include: [
        {
          model: Role,
          attributes: ["name"],
          through: { attributes: [] },
        },
      ],
    });

    const result = users.map((u) => {
      const roleNames = u.roles.map((r) => "ROLE_" + r.name.toUpperCase());
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        roles: roleNames,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Błąd getAllUsers:", err);
    return res.status(500).json({ message: "Wewnętrzny błąd serwera." });
  }
};

exports.updateUserRoles = async (req, res) => {
  const userId = req.params.id;
  const { roles } = req.body; // np. ["ROLE_ADMIN"]

  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ message: "Brak ról w żądaniu." });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "Nie znaleziono użytkownika." });

    const stripped = roles.map((r) => r.replace(/^ROLE_/, "").toLowerCase());
    const foundRoles = await Role.findAll({
      where: { name: stripped },
    });

    if (foundRoles.length === 0) {
      return res.status(400).json({ message: "Żadne role nie zostały znalezione." });
    }

    await user.setRoles(foundRoles);

    const updatedUser = await User.findByPk(userId, {
      attributes: ["id", "username", "email"],
      include: [
        {
          model: Role,
          attributes: ["name"],
          through: { attributes: [] },
        },
      ],
    });

    const roleNames = updatedUser.roles.map((r) => "ROLE_" + r.name.toUpperCase());
    return res.status(200).json({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      roles: roleNames,
    });
  } catch (err) {
    console.error("Błąd updateUserRoles:", err);
    return res.status(500).json({ message: "Wewnętrzny błąd serwera." });
  }
};


exports.allAccess = (req, res) => {
  res.status(200).send("Public Content.");
};

exports.userBoard = (req, res) => {
  res.status(200).send("User Content.");
};

exports.adminBoard = (req, res) => {
  res.status(200).send("Admin Content.");
};

exports.moderatorBoard = (req, res) => {
  res.status(200).send("Moderator Content.");
};

exports.deleteUser = async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "Użytkownik nie istnieje." });
    }
    await user.destroy();
    return res.status(200).json({ message: "Użytkownik usunięty." });
  } catch (err) {
    console.error("Błąd deleteUser:", err);
    return res.status(500).json({ message: "Wewnętrzny błąd serwera." });
  }
};