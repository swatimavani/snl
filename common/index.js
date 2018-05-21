var env       = process.env.NODE_ENV || 'development';
var winston = require('winston');
require('winston-daily-rotate-file');
var fs = require('fs');
module.exports.config = require(__dirname + '/../config/config.json')[env];

module.exports.Log = function (data,type,isConsole){
	if (!fs.existsSync("logs")){
		fs.mkdirSync("logs");
	}
	var transport = new (winston.transports.DailyRotateFile)({
		filename: './logs/log',
		datePattern: 'yyyy-MM-dd.',
		prepend: true,
		maxDays:5	
	  });
	 
	  var logger = new (winston.Logger)({
		transports: [
		  transport
		]
		});
		
	  if(isConsole){
		  console.log(data);
      }
    if(type == 'error'){
        logger.error(data);
    }else{
        logger.info(data);
    }
}