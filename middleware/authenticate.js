exports.isExpire = function(req, res, next){
  if(req){
    var user = req.user;   
    var models = require('../models');
    var token = (req.headers.authorization).split(" ");
    models.AccessToken.findOne({
        where:{user_id:req.user.id,token:token[1],is_expire:'0'}
    }).then(accessToken=>{
      	if(accessToken){
        	next();    
      	}else{
        	return res.json({response:{status: 'error', message: 'Invalid Login or Login expired'},data:{}});
      	}
    });
  }else{
    return res.json({response:{status: 'error', message: 'User not found.'},data:{}});
  }
}