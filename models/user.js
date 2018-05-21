'use strict';

module.exports = (sequelize, DataTypes) => {
    var User = sequelize.define('User', {
        firebase_id: DataTypes.STRING,
        device_id: DataTypes.STRING,
        facebook_id: DataTypes.STRING,
        google_id: DataTypes.STRING,
        username: DataTypes.STRING,
        primary_currency: DataTypes.INTEGER,
        secondary_currency: DataTypes.INTEGER,
        profile_link:DataTypes.STRING,
        data:DataTypes.TEXT,
        status:DataTypes.ENUM('offline','online','playing'),
        deleted: DataTypes.ENUM('0','1'),
        createdAt: DataTypes.DATE
    }, {
        classMethods: {
            associate: function(models) {
                User.hasOne(models.Leaderboard);
            }
        },
        getterMethods   : {
            // address: function()  { return this.state + ', ' + this.country }
        },
        setterMethods   : {
            /*address: function(value) {
                var names = value.split(', ');
                this.setDataValue('country', names[0]);
                this.setDataValue('state', names[1]);
            },*/
        }
    });
    return User;
};