'use strict';
module.exports = (sequelize, DataTypes) => {
  var Multiplayer = sequelize.define('Multiplayer', {
    player1: DataTypes.INTEGER,
    player2: DataTypes.INTEGER,
    winner_position: DataTypes.ENUM('0','1','2')
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Multiplayer;
};