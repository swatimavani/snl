'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      firebase_id: {
        type: Sequelize.STRING
      },
      device_id: {
        type: Sequelize.STRING
      },
      facebook_id: {
        type: Sequelize.TEXT
      },
      google_id: {
        type: Sequelize.STRING
      },
      username: {
        type: Sequelize.STRING
      },
      primary_currency: {
        type: Sequelize.INTEGER
      },
      secondary_currency: {
        type: Sequelize.INTEGER
      },
      profile_link: {
        type: Sequelize.STRING
      },
      status:{
        type: Sequelize.ENUM('offline','online','playing')
      },
      data: {
        type: Sequelize.TEXT('Long')
      },
      deleted: {
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
    return queryInterface.dropTable('Users');
  }
};