'use strict';
module.exports = (sequelize, DataTypes) => {
  var UserDeviceDetails = sequelize.define('UserDeviceDetails', {
    user_id: DataTypes.INTEGER,
    device_id: DataTypes.STRING,
    device_token: DataTypes.STRING
  }, {
    classMethods: {
      associate: function(models) {
        UserDeviceDetails.belongsTo(models.User);
      }
    }
  });
  return UserDeviceDetails;
};