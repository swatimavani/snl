'use strict';
module.exports = (sequelize, DataTypes) => {
    var Friend = sequelize.define('Friend', {
        sender_user_id: DataTypes.INTEGER,
        receiver_user_id: DataTypes.INTEGER,
        status: DataTypes.ENUM('requested', 'accepted', 'rejected')
    }, 
    {
        classMethods: {
            associate: function(models) {       
                Friend.belongsTo(models.User,{foreignKey: 'sender_user_id', targetKey: 'id','as':'sender_user'});
                Friend.belongsTo(models.User,{foreignKey: 'receiver_user_id', targetKey: 'id','as':'receiver_user'});
            }
        }
    });
    return Friend;
};