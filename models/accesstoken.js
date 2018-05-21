'use strict';
module.exports = (sequelize, DataTypes) => {
  var AccessToken = sequelize.define('AccessToken', {
    user_id: DataTypes.INTEGER,
    device_id: DataTypes.STRING,
    token: DataTypes.STRING,
    is_expire: DataTypes.ENUM('0','1')
  }, {
    classMethods: {
      associate: function(models) {
        AccessToken.belongsTo(models.User);
      }
    }
  });
  return AccessToken;
};