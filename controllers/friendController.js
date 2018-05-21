var models = require('../models');
var moment = require('moment');


module.exports.sendRequest = function(req,res){ 
    var user = req.user;  
    if(req.user.id != req.body.user_id){       
        models.Friend.findOrCreate({
            where:{
                $or:[
                    {$and:[{sender_user_id:user.id},{receiver_user_id:req.body.user_id}]},
                    {$and:[{receiver_user_id:user.id},{sender_user_id:req.body.user_id}]}
                ]
            },
            defaults:{sender_user_id:req.user.id,receiver_user_id:req.body.user_id,status:'requested'}
        }).spread((friend,created) => {
            if(!created && friend){
                if(friend.status == 'requested'){
                    res.json({response:{status: 'error', message: 'Request already pending.'},data:{}});
                }else if(friend.status == 'accepted'){
                    res.json({response:{status: 'error', message: 'You are already friend.'},data:{}});
                }
                
            }else if(created){
                res.json({response:{status: 'success', message: 'Friend request sent.'},data:{}});
            }
        })
    }else{
        res.json({response:{status: 'error', message: 'user not found.'},data:{}});
    }
    
}

module.exports.friendList = function(req,res){
    var user = req.user;   
    models.Friend.findAll({
        attributes:['id','sender_user_id','receiver_user_id','status'],
        include:[{
            as:'sender_user',
            model:User,
            attributes:['id','username'],
            where:{deleted:'0'}
        },{
            as:'receiver_user',
            model:User,
            attributes:['id','username'],
            where:{deleted:'0'}
        }],
        where:{
            $or:[{sender_user_id:user.id},{receiver_user_id:user.id}],
            $not:{status:'rejected'}
        },
        order:[['status','ASC']]
    }).then(friends =>{
        var friend_data = {requested_list:[],pending_list:[],friend_list:[]};
        var requested_list = [], friend_list = [], pending_list = [];
        friends.forEach(function(friend) {
            var record = {id:friend.id,status:friend.status};               
            if(friend.status == 'requested'){
                if(friend.sender_user_id == user.id){
                    record.user_id = friend.receiver_user_id;
                    record.friend_name = friend.receiver_user?friend.receiver_user.username:'';
                    record.profile_link = friend.receiver_user?friend.receiver_user.profile_link:'';                       
                    requested_list.push(record);
                }else{
                    record.user_id = friend.sender_user_id;
                    record.friend_name = friend.sender_user?friend.sender_user.username:'';
                    record.profile_link = friend.sender_user?friend.sender_user.profile_link:'';
                    record.status = 'pending';
                    pending_list.push(record);
                }
            }else{
                if(friend.sender_user_id == user.id){
                    record.user_id = friend.receiver_user_id;
                    record.friend_name = friend.receiver_user?friend.receiver_user.username:'';
                    record.profile_link = friend.receiver_user?friend.receiver_user.profile_link:'';
                    friend_list.push(record);
                }else{
                    record.user_id = friend.sender_user_id;
                    record.friend_name = friend.sender_user?friend.sender_user.username:'';
                    record.profile_link = friend.sender_user?friend.sender_user.profile_link:'';
                    friend_list.push(record);
                }                   
            }
            friend_data = {requested_list:requested_list,friend_list:friend_list,pending_list:pending_list};
        });           
        res.json({response:{status: 'success', message: 'Friend List retrieved successfully.'},data:friend_data});
    });   
}

module.exports.handleFriendRequest = function(req,res){
    var user = req.user;
    if(req.body.status == 'remove'){
        models.Friend.destroy({
            where: {status: 'accepted',id:req.body.request_id},               
        }).then(friend=>{               
            res.json({response:{status: 'success', message: 'Friend Removed from friend list.'},data:{}});
        });
    }else if(req.body.status == 'reject'){
        Friend.destroy({
            where: {id:req.body.request_id,receiver_user_id:user.id},               
        }).then(friend=>{               
            res.json({response:{status: 'success', message: 'Friend Request rejected.'},data:{}});
        });
    }else if(req.body.status == 'accept'){
        var update_request = {
            status:'accepted'
        };
        Friend.update(update_request,
        {
            where:{receiver_user_id:user.id,id:req.body.request_id}
        }).then(friend=>{
            if(friend){
                res.json({response:{status: 'success', message: 'Friend Request is '+update_request.status+'.'},data:{}});
            }else{
                res.json({response:{status: 'error', message: 'No request found to accept or reject.'},data:{}});
            }           
        });
    }else{
        res.json({response:{status: 'error', message: 'Request status invalid.'},data:{}});
    }
}

