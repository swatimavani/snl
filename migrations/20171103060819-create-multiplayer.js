'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Multiplayers', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      player1: {
        type: Sequelize.INTEGER
      },
      player2: {
        type: Sequelize.INTEGER
      },
      player3: {
        type: Sequelize.INTEGER
      },
      player4: {
        type: Sequelize.INTEGER
      },
      data:{
        type:Sequelize.TEXT('Long')
      },
      winner_position: {
        type: Sequelize.ENUM('0','1','2')
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
    return queryInterface.dropTable('Multiplayers');
  }
};