var models = require("../models");
var jwt = require('jsonwebtoken');
var common = require('../common');
var config = common.config;

module.exports.logout = function(req,res){
	var user = req.user;
	var token = (req.headers.authorization).split(" ");
	models.User.findOne({
		where:{id:user.id}
	}).then(user=>{
		if(user && user.device_id != null && user.device_id != ''){
			user.deleted = 1;
			user.save();
		}
	});
	models.AccessToken.destroy({
		where:{token:token[1],user_id:req.user.id}
	}).then(accessToken=>{	
		res.json({response:{status: 'success', message: 'Logout successful.'},data:{}});
	}).catch(function(error){	
		common.log.error(error);	
	});
}

module.exports.login = function(req,res){	
	if(!req.body.username){
		return res.json({response:{status: 'error', message: 'Username field is required.'},data:{}});
	}else if(!req.body.device_id){
		return res.json({response:{status: 'error', message: 'Device Id field is required.'},data:{}});
	}
	console.log('Device ID: '+req.body.device_id);
	console.log('username: '+req.body.username);
	var user_data = {username:req.body.username,email:req.body.email,profile_link:req.body.profile_link,data:req.body.data};	
	var where = '';
		if(req.body.facebook_id){
			where = {facebook_id:req.body.facebook_id};
			user_data.facebook_id = req.body.facebook_id; 
		}else if(req.body.device_id){
			where = {device_id:req.body.device_id,deleted:'0'};
			user_data.device_id = req.body.device_id; 
		} 
	models.User.findOrCreate({
		attributes:['id','username','data'],
		where:where,
		defaults:user_data
	}).spread((user,created)=>{
		if(created){
			console.log('created user');
		}else{
			console.log('user');
		}

		var token = generateToken(user,req);
		var _data = user && user.data?JSON.parse(user.data):{};
		var _id = user && user.id?JSON.parse(user.id):0;
		res.json({response:{status: 'success', message: 'Login successfully.'},data:{data:_data,id:_id,token:token}});
	});
}

module.exports.updateUserData = function(req,res){
	models.User.update({data:req.body.data},{
		where:{
			id:req.body.user_id
		}
	}).then(function(user){
		res.json({response:{status: 'success', message: 'User details updated successfully.'},data:{}});
	});
}
function generateToken(user,req){
	var token  = jwt.sign({
		id: user.id,
		username:user.username
	}, config.secret);
	models.UserDeviceDetails.update({user_id:user.id},{where:{device_id:req.body.device_id}});
	models.AccessToken.create({token: token, user_id: user.id,is_expire:'0',device_id:req.body.device_id});
	return token;
}

module.exports.storeUserDeviceDetails = function(req,res){
	if (!req.body.device_id || req.body.device_id == '') {
		res.json({status: 'error', message: 'Device Id is required.'});
	}else if (!req.body.device_token || req.body.device_token == '' ) {
		res.json({status: 'error', message: 'Device Token is required.'});
	}else if (req.body.device_token.length < 152 ) {
		res.json({status: 'error', message: 'Invalid device token.'});
	}else{	
		var userDeviceDetailData = {
			user_id:0,
			device_id:req.body.device_id,
			device_token:req.body.device_token
		}
		models.UserDeviceDetails.findOrCreate({
			where: {device_id:req.body.device_id}, 
			defaults: userDeviceDetailData
		}).spread(function(user_device_details,created){
			if(!created){
				user_device_details.device_token = req.body.device_token;
				user_device_details.save();
			}
			res.json({response:{status: 'success', message: 'User Device Details Updated.'},data:{}})
		})
	}
}

module.exports.getOnlineAndPlayingUsers = async (req,res)=>{
	var facebook_id = req.body.friends?req.body.friends.split(','):[];
	console.log('req',req.body);
	var online_users = await models.User.findAll({
		attributes:["id","facebook_id","status"],
		where:{facebook_id:{$in:facebook_id},$or:[{status:'online'},{status:'playing'}]}
	});
	res.json({response:{status: 'success', message: 'Online users retrieved successfully.'},data:online_users});
}