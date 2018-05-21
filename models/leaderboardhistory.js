'use strict';
module.exports = (sequelize, DataTypes) => {
    var LeaderboardHistory = sequelize.define('LeaderboardHistory', {
        user_id: DataTypes.INTEGER,
        score: DataTypes.INTEGER,
        type: DataTypes.ENUM('daily','weekly','monthly'),
        date: DataTypes.DATEONLY,
        is_price_collected: DataTypes.ENUM('0','1')
    }, 
    {
        classMethods: {
            associate: function(models) {
                LeaderboardHistory.belongsTo(models.User);
            }
        }
    });
  return LeaderboardHistory;
};