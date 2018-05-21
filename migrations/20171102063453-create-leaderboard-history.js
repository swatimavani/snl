'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('LeaderboardHistories', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER       
      },
      score: {
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.ENUM('daily','weekly','monthly')
      },
      date: {
        type: Sequelize.DATEONLY
      },
      is_price_collected: {
        type: Sequelize.ENUM('0','1')
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('LeaderboardHistories');
  }
};