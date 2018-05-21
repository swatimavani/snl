exports.notFound = function notFound(req, res, next){
	res.status(404).send('You seem lost. You must have taken a wrong turn back here.');
};

exports.error = function error(err, req, res, next){
	console.log(err);
	if(err.constructor.name == 'UnauthorizedError'){
		res.send({success:false,message:'Unauthorized user'});
	}else{
		res.status(500).send('Something broke. What did you do?');
	}
	
};