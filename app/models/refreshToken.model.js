module.exports = (sequelize, Sequelize) => {
  const RefreshToken = sequelize.define("refreshToken", {
    token: {
      type: Sequelize.STRING(512), // Zwiększony rozmiar dla JWT tokenów
    },
    userId: {
      type: Sequelize.INTEGER,
    },
    expiryDate: {
      type: Sequelize.DATE,
    },
  });

  return RefreshToken;
};