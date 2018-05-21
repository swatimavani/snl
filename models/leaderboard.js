'use strict';
module.exports = (sequelize, DataTypes) => {
  var Leaderboard = sequelize.define('Leaderboard', {
    user_id: DataTypes.INTEGER,
    daily_score: DataTypes.INTEGER,
    weekly_score: DataTypes.INTEGER,
    monthly_score: DataTypes.INTEGER,
    all_time_score: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        Leaderboard.belongsTo(models.User);
      }
    }
  });
  return Leaderboard;
};