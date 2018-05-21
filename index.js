	var express = require('express');
var app = express();
const http = require('http');
var bodyParser = require("body-parser");
var cluster = require("cluster");
var passport = require('passport');
var env       = process.env.NODE_ENV || 'development';
var config    = require(__dirname + '/config/config.json')[env];
var common = require('./common');
var errorHandlers = require('./middleware/errorHandlers');
const socketIO = require('socket.io');
var redis = require("redis");
var validator = require('validator');
const uuidv1 = require('uuid/v1');
var port = config.port_no;


var server = http.Server(app);
var io = socketIO(server);
var models = require("./models");

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());
var routes = require('./routes');
app.use('/', routes);
app.use(errorHandlers.error);

server.listen(port, () => {
    console.log("Server is up on port "+port);
});
const maxPlayersinRoom = config.maxPlayersinRoom;
const maxRooms = config.maxRooms;
const allowSwitchingRoom = config.allowSwitchingRoom;//true = leave current room and enter new //false = stay in current room until leave room is called

const roomOptionsDefault = {
	'isVisible': true,
	'isOpen': false,
	'gameStarted': false,
	'maxPlayers': maxPlayersinRoom,
	'customRoomProperties':{},
};
var rooms = {};
var player = {};
var player_room = {};
var connected_user = new Array();

var userById = async (user_id)=>{
	var user = await models.User.findById(user_id,{attributes:['id','username']});
    return user;
}
io.on("connection",(socket) => {
	console.log("Connected");   
    socket.on('add user',function(data){
		console.log('add user: '+JSON.stringify(data));
		socket.emit("LeaveRoom",{user_id:data.user_id});
		var user_id = data.user_id?data.user_id:0;
		var user_socket = "connectedUser"+data.user_id;	
		manageUserStatus(user_id,'online');
		connected_user[user_socket] = new Array();
        connected_user[user_socket]["socket_id"] = socket.id;                     
	})
    socket.on("disconnect", () => {	
		var users_length = Object.keys(connected_user).length;		
		if(users_length > 0){		
			user_socket_key = Object.keys(connected_user).find(key => connected_user[key]["socket_id"] === socket.id);						
			if(user_socket_key){
				user_id = user_socket_key.replace("connectedUser","");			
				var userRoomKey = "user"+user_id;
			}else{
				user_id = 0;
				var userRoomKey = "";
			}				
			manageUserStatus(user_id,'offline');
			var roomName = '';
			var roomData = '';				
			if(player_room[userRoomKey] && rooms[player_room[userRoomKey]] && rooms[player_room[userRoomKey]]['playerList']){
				if(Object.keys(rooms[player_room[userRoomKey]]['playerList']).length>0){
					roomName = player_room[userRoomKey];				
					roomData = rooms[player_room[userRoomKey]];
					fullroomdata = GetFullRoomData(roomName);
					delete rooms[player_room[userRoomKey]]['playerList'][userRoomKey];
					console.log('Player disconnected from server');
					var responseData = {'status':true,'message':'Player disconnected from server',room:fullroomdata,playerId:user_id};
					io.in(roomName).emit('OnPlayerDisconnected',responseData);
				}
			}
	
			if(player_room[userRoomKey] && rooms[player_room[userRoomKey]])
			if(rooms[player_room[userRoomKey]]['playerList'] && Object.keys(rooms[player_room[userRoomKey]]['playerList']).length == 0)
				delete rooms[player_room[userRoomKey]];
			if(player_room[userRoomKey]) delete player_room[userRoomKey];
			if(player[userRoomKey]) delete player[userRoomKey];
			var responseData = {'status':true,'message':'Player disconnected from server',room:roomData,playerId:user_id};
			socket.emit("OnDisconnectedFromServer",responseData);				
			console.log("Socket disconnected: "+socket.id);		
		}
		
    });
    socket.on("CreateRoom", (data,callback) => {   	
		common.Log("create room",'info',true);	
		var _userId = data.user_id?"user"+data.user_id:"user0";     
		console.log("Friend: "+data.user_id2);
        var friend_user_id = data.user_id2;
        
        if(!CheckRoomsLimit()){
			common.Log("Maximum number of rooms limit reached",'info',true);		
			socket.emit('OnCreateRoomFailed',{'status': false,'message': "Maximum number of rooms limit reached"});
			return;
		}

		var roomOptions = roomOptionsDefault;
		var roomName = (typeof data.roomName !== "undefined")?data.roomName:uuidv1();	
		
		if(allowSwitchingRoom && player_room[_userId] && player_room[_userId]!=data.roomName){
			if(player_room[_userId]){
				socket.leave(player_room[_userId]);
				if(typeof rooms[player_room[_userId]]['playerList'][_userId]!=="undefined"){
					delete rooms[player_room[_userId]]['playerList'][_userId];
					if(Object.keys(rooms[player_room[_userId]]['playerList']).length==0)
						delete rooms[player_room[_userId]];
				}
				delete player_room[_userId];
			}
		}

		if(rooms[roomName]) {
			common.Log("room already exists",'info',true);          
			socket.emit('OnCreateRoomFailed',{'status': false,'message': "room already exists"});
			return;
		}

		roomOptions.isVisible = data.customRoomProperties && data.customRoomProperties.isVisible == 'false'?false:true;
		roomOptions.isOpen = data.isOpen?data.isOpen:roomOptions.isOpen;
		roomOptions.maxPlayers = data.maxPlayers?data.maxPlayers:roomOptions.maxPlayers;
		roomOptions.customRoomProperties = data.customRoomProperties?data.customRoomProperties:roomOptions.customRoomProperties;
		
		var playerList = {};
		playerList[_userId] = data.user_id;
		
		player_room[_userId] = roomName;
		rooms[roomName] = {id: roomName, roomOptions: roomOptions, playerList: playerList};

		fullroomdata = GetFullRoomData(roomName);
		
		socket.join(roomName);
		var isChallenge = false;
		var friend_user_socket = data.user_id2 > 0?"connectedUser"+data.user_id2:'';	
		if(data.user_id2 > 0){		
			if(connected_user[friend_user_socket] && connected_user[friend_user_socket]["status"] != 'playing' && connected_user[friend_user_socket]["status"] != 'offline'){
				models.User.findById(data.user_id,{attributes:['id','username']}).then(user=>{
					if(user){									
						var responseData = 	{'status': true,'message': "room created ",data:{user:user,roomName:roomName}};
						io.to(connected_user[friend_user_socket]["socket_id"]).emit('challenge request', responseData);           
					}else{
						var responseData = 	{'status': false,'message': "User not found",data:{}};
						io.to(connected_user[friend_user_socket]["socket_id"]).emit('challenge request', responseData); 
					}
				});
				isChallenge = true;
			}else{
				var currentUsersocket = "connectedUser"+data.user_id;
				io.to(connected_user[currentUsersocket]["socket_id"]).emit('challenge request', {'status': false,'message': "Challenging user is Offline or Playing with other.",data:{}}); 
			}
		}	
		socket.emit("OnCreatedRoom",{'status': true,'message': "room created "+ roomName,"isChallenge":isChallenge});
		socket.emit("OnJoinedRoom",{'status': true,'message': "room created "+ roomName + ":",room: fullroomdata,playerId: data.user_id});
		io.in(roomName).emit("OnPlayerConnected",{'status': true,'message': "room created "+ roomName + ":",room: fullroomdata,playerId: data.user_id});
		common.Log("Room created: "+ roomName,'info',true);	
    });   
    socket.on('manage request',function(data){
		if(data.status == 'accept'){	
			fullroomdata = GetFullRoomData(data.roomName);		
			var playerListLength = Object.keys(rooms[data.roomName]['playerList']).length;		
			var user_ids = [];
			if(playerListLength > 0){
				var user_ids = Object.keys(rooms[data.roomName]['playerList']).map(function(key) {
					return rooms[data.roomName]['playerList'][key];
				  });			  
			}	
			var roomCreator = user_ids.length > 0?user_ids[0]:0;
			io.in(data.roomName).emit('manage response', {'status': true,'message': "Request accepted",data:roomCreator});
			
		}else{
			io.in(data.roomName).emit('manage response', {'status': false,'message': "Request rejected",data:data});
		}
	})
    socket.on("JoinRoom", (data) => {
		var _userId = data.user_id?"user"+data.user_id:"user0";	
		if(typeof rooms[data.roomName] == "undefined"){
			socket.emit('OnJoinRoomFailed',{'status': false, 'message': "Room doesn't exist"});
			common.Log("Room doesn't exist",'info',true);		
			return;
		}
		if(typeof rooms[data.roomName]["playerList"] !== "undefined") {
			playerCountinRoom = Object.keys(rooms[data.roomName]["playerList"]).length+1;
		}
		else {
			var playerCountinRoom = 1;
			rooms[data.roomName]["playerList"] = {};
		}
        //check if room is full       
		if(playerCountinRoom > GetMaxAllowedPlayersInRoom(data.roomName)){
			console.log("Room is full");
			socket.emit('OnJoinRoomFailed',{'status': false, 'message': "Room is full"});
			return;
		}
        //check if Player already in room       
		for(currentPlayerId in rooms[data.roomName]["playerList"]){
			if(rooms[data.roomName]["playerList"][currentPlayerId] == data.user_id){
                console.log("Player already in room");			
				socket.emit('OnJoinRoomFailed',{'status': false, 'message': "Player already in room"});
				return;
			}
		}

		if(allowSwitchingRoom && typeof player_room[_userId]!=="undefined" && player_room[_userId]!=data.roomName){
			if(typeof player_room[_userId]!=="undefined"){
				socket.leave(player_room[_userId]);
				if(typeof rooms[player_room[_userId]]!=="undefined" && typeof rooms[player_room[_userId]]['playerList']!=="undefined" && typeof rooms[player_room[_userId]]['playerList'][_userId]!=="undefined"){
					delete rooms[player_room[_userId]]['playerList'][_userId];
					if(Object.keys(rooms[player_room[_userId]]['playerList']).length==0)
						delete rooms[player_room[_userId]];
				}
				delete player_room[_userId];
			}
		}

		socket.join(data.roomName);
		rooms[data.roomName]["playerList"][_userId] = data.user_id;
		player_room[_userId] = data.roomName;	
		fullroomdata = GetFullRoomData(data.roomName);

		if(Object.keys(rooms[data.roomName]['playerList']).length==GetMaxAllowedPlayersInRoom(data.roomName)){
			if(StartGame(data.roomName))
			{				
				var user_ids = [];			
				var user_ids = Object.keys(rooms[data.roomName]['playerList']).map(function(key) {
					return rooms[data.roomName]['playerList'][key];
				});			  						
				console.log("Game Started");			
				manageUserStatus(user_ids,'playing');			
				io.in(data.roomName).emit('OnGameStarted',{'status': true, 'message': "Game Started", room: fullroomdata});
			}
		}
		console.log("Player joined room");		
		socket.emit('OnJoinedRoom',{'status': true, 'message': "Player joined room", room: fullroomdata,playerId: data.user_id});
		io.in(data.roomName).emit('OnPlayerConnected',{'status': true, 'message': "Player joined room", room: fullroomdata,playerId: data.user_id});
    });
    
   
    socket.on("GetRoomList", () => {
		var open_rooms = Array();
		for(roomId in rooms){
			let temp_room = {};
			if(((typeof rooms[roomId] !== "undefined" && typeof rooms[roomId]['playerList']=="undefined") || ( typeof rooms[roomId] !== "undefined" && typeof rooms[roomId]['playerList'] !=="undefined" && Object.keys(rooms[roomId]['playerList']).length < GetMaxAllowedPlayersInRoom(roomId)))
			&& rooms[roomId]['roomOptions'].isOpen
			&& rooms[roomId]['roomOptions'].isVisible
			&& !rooms[roomId]['roomOptions'].gameStarted)
			{
				temp_room['id'] = rooms[roomId]['id'];
				temp_room['playerCount'] = Object.keys(rooms[roomId]['playerList']).length;
				temp_room['maxPlayers'] = rooms[roomId]['roomOptions']['maxPlayers'];
				temp_room['customRoomProperties'] = rooms[roomId]['roomOptions']['customRoomProperties'];
				open_rooms.push(temp_room);
			}
		}	
		console.log("Get Room List");	
		socket.emit('GetRoomList',{rooms: open_rooms});
    });

    socket.on("SetPlayerCustomProperties", (data) => {	
        var _userId = data.user_id?"user"+data.user_id:"user0";       
		if(typeof player[_userId]=="undefined") player[_userId]={};
		for(var key in data){
			player[_userId][key] = data[key];
		}
	});

	socket.on("LeaveRoom", (data) => {
		var _userId = data.user_id?"user"+data.user_id:"user0";	
		console.log("Leave Room");
		if(typeof player_room[_userId]!=="undefined"){

			socket.leave(player_room[_userId]);
			roomName = player_room[_userId];
			roomData = rooms[player_room[_userId]];
			playerRoom = player_room[_userId];
			if(player_room[_userId] && rooms[player_room[_userId]] && rooms[player_room[_userId]]['playerList'] && rooms[player_room[_userId]]['playerList'][_userId])
				delete rooms[player_room[_userId]]['playerList'][_userId];
			if(Object.keys(rooms[player_room[_userId]]['playerList'])==0){
				delete rooms[player_room[_userId]];
			}
			delete player_room[_userId];		
			fullroomdata = GetFullRoomData(roomName);
			manageUserStatus(data.user_id,'online');
			if(rooms && rooms[playerRoom] && rooms[playerRoom]['playerList'] && Object.keys(rooms[playerRoom]['playerList']).length>0){			
				io.in(roomName).emit('OnPlayerDisconnected',{'status':true,'messsage':'Player left room',room:fullroomdata,playerId:data.user_id});
			}		
			socket.emit('OnLeftRoom',{'status':true,'message': 'Player left room',room:roomData,playerId: data.user_id});
		}
	});

	socket.on('Message', function (data) {	
		if(data.data)
			socket.to(data.data.roomName).emit(data.methodName, data.data);
		else
			socket.to(data.roomName).emit(data.methodName);	
	});

	socket.on('MessageToAll', function (data) {		
		if(data.data)		{		
			io.in(data.data.roomName).emit(data.methodName, data.data);
		}
		else{		
		   	io.in(data.roomName).emit(data.methodName);
		}
    });

    socket.on('MessageToFirstPlayer', function (data) {
		common.Log('Message To First Player','info',true);	
		var _userId = data.user_id?"user"+data.user_id:"user0";
        if(typeof player_room[_userId]!='undefined' && typeof rooms[player_room[_userId]]!='undefined' && typeof rooms[player_room[_userId]]['playerList']!='undefined' && typeof rooms[player_room[_userId]]['playerList']!='undefined'){
            let firstPlayer = rooms[player_room[_userId]]['playerList'][Object.keys(rooms[player_room[_userId]]['playerList'])[0]];
            if(typeof data.data !== "undefined" && data.data != null)
                socket.to(firstPlayer).emit(data.methodName, data.data);
            else
                socket.to(firstPlayer).emit(data.methodName);
        }
	});
	socket.on("GameStop", (data) => {	
		io.of('/').in(data.roomName).clients(function(error, clients) {
			if (clients.length > 0) {
				LogData('clients in the room: '+clients);
				clients.forEach(function (socket_id) {
					io.sockets.sockets[socket_id].leave(data.roomName);
					io.sockets.connected[socket_id].disconnect();
				});
			}
		});
		//need to call socket.disconnect
	});
});

function CheckRoomsLimit(){
	if(maxRooms==0) return true;
	if(Object.keys(rooms).length>maxRooms){
		return false;
	}
	return true;
}


function GetFullRoomData(roomName){
	if(typeof rooms[roomName]!=="undefined"){
		fullroomdata = JSON.parse(JSON.stringify(rooms[roomName]));
		fullroomdata['playerList'] = Array();
		for(var key in rooms[roomName]['playerList']){		
			if(typeof player[key]!=="undefined"){
				fullroomdata['playerList'].push({id:player[key].user_id, customPlayerProperties:player[key]});
				// fullroomdata['playerList'].push({id:key, customPlayerProperties:player[key]});
			}
			else fullroomdata['playerList'][key] = '';
		}
		return fullroomdata;
	}
	return '';
}

function StartGame(roomName){
	if(typeof rooms[roomName] == "undefined"){	
		return false;
	}
	if(typeof rooms[roomName]["playerList"] == "undefined") {	
		return false;
	}
	roomOptionsStart = {
		'isVisible': false,
		'isOpen': false,
		'gameStarted': true,
		'maxPlayers': rooms[roomName]['roomOptions']['maxPlayers'],
		'customRoomProperties':rooms[roomName]['roomOptions']['customRoomProperties'],
	};
	rooms[roomName]['roomOptions'] = roomOptionsStart;
	return true;
}

function GetMaxAllowedPlayersInRoom(roomName){
	if(typeof rooms[roomName]!=="undefined" && typeof rooms[roomName]['roomOptions']!=="undefined" && typeof rooms[roomName]['roomOptions']['maxPlayers'])
	{
		return rooms[roomName]['roomOptions']['maxPlayers'];
	}
	return 0;
}



function manageUserStatus(user_id,status){
	console.log("user_id: "+user_id);
	console.log("status: "+status);
	if (Array.isArray(user_id)){
		user_id.forEach(function(user){
			var user_socket = "connectedUser"+user;
			if(connected_user[user_socket])
				connected_user[user_socket]["status"] = status;
		})
		models.User.update({status:status},{where:{id:{$in:user_id}}});
	}else{
		var user_socket = "connectedUser"+user_id;
		if(connected_user[user_socket])
			connected_user[user_socket]["status"] = status;
		models.User.update({status:status},{where:{id:user_id}});
	}
	
}