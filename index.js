var express = require('express');
var app = express();
const http = require('http');
var bodyParser = require("body-parser");
var passport = require('passport');
var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/config/config.json')[env];
var common = require('./common');
var errorHandlers = require('./middleware/errorHandlers');
const socketIO = require('socket.io');
var validator = require('validator');
const uuidv1 = require('uuid/v1');
var port = config.port_no;
var _ = require('lodash');

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
	console.log("Server is up on port " + port);
});

const maxRooms = config.maxRooms;

const roomOptionsDefault = {
	'isVisible': true,
	'isOpen': true,
	'gameStarted': false,
	'maxPlayers': config.maxPlayersinRoom,
	'customRoomProperties': {},
};
var rooms = [];
var player = {};
var player_room = {};
var connected_user = new Array();
const STATUS = {online:'online',offline:'offline',playing:'playing'};

io.on("connection", (socket) => {
	socket.on('add user', function (data) {
		let user = {};
		socket.emit("LeaveRoom",{user_id:data.user_id});
		socket.user_id = data.user_id;
		user.user_id = data.user_id ? data.user_id : 0;
		user.socket_id = socket.id;
		user.isInRoom=false;
		manageUserStatus(user.user_id,STATUS.online);
		connected_user.push(user);

	})
	socket.on("disconnect", () => {
		let userIndex = _.findIndex(connected_user, { user_id: socket.user_id });
		if (userIndex >= 0) {
			socket.emit("LeaveRoom",{});
			var userRoomKey = "user" + connected_user[userIndex].user_id;
			manageUserStatus(connected_user[userIndex].user_id, 'offline');
			var roomData = '';
			var responseData = { 'status': true, 'message': 'Player disconnected from server', room: roomData, playerId: connected_user[userIndex].user_id };
			socket.emit("OnDisconnectedFromServer", responseData);
			console.log("Socket disconnected: " + socket.id);
		}

	});
	socket.on("CreateRoom", async function(data,callback) {
		common.Log("create room", 'info', true);
		var _userId = data.user_id ? "user" + data.user_id : "user0";
		let userIndex = _.findIndex(connected_user, { user_id: socket.user_id });
		console.log("Friend: " + data.user_id2);
		var friend_user_id = data.user_id2;

		if (connected_user[userIndex].isInRoom === false) {
			console.log("'Is in room");
			var roomName = data.roomName ? data.roomName : uuidv1();
			var roomIndex = _.findIndex(rooms,{id:roomName});
			if(roomIndex < 0){
				let roomOptions = roomOptionsDefault;
				let playerList = [];

				roomOptions.isVisible = data.customRoomProperties && data.customRoomProperties.isVisible == 'false' ? false : true;
				roomOptions.isOpen = data.isOpen ? data.isOpen : roomOptions.isOpen;
				roomOptions.maxPlayers = data.maxPlayers ? data.maxPlayers : roomOptions.maxPlayers;
				roomOptions.customRoomProperties = data.customRoomProperties ? data.customRoomProperties : roomOptions.customRoomProperties;

				playerList[_userId] = data.user_id;
				player_room[_userId] = roomIndex;
				rooms.push({ id: roomName, roomOptions: roomOptions, playerList: playerList });
				fullroomdata = GetFullRoomData(roomIndex);
				connected_user[userIndex].isInRoom = true;
				socket.join(roomName);
				if (data.user_id2 > 0) {
					await sendRequest(data,socket,roomName);
				}
				socket.emit("OnCreatedRoom", { 'status': true, 'message': "room created " + roomName });
				socket.emit("OnJoinedRoom", { 'status': true, 'message': "room created " + roomName + ":", room: fullroomdata, playerId: data.user_id });
				io.in(roomName).emit("OnPlayerConnected", { 'status': true, 'message': "room created " + roomName + ":", room: fullroomdata, playerId: data.user_id });
				common.Log("Room created: " + roomName, 'info', true);
			}else{
				socket.emit('OnCreateRoomFailed', { 'status': false, 'message': "room already exists" });
			}
		}else{
			common.Log("Maximum number of rooms limit reached", 'info', true);
			socket.emit('OnCreateRoomFailed', { 'status': false, 'message': "Maximum number of rooms limit reached" });		
		}
	});

	socket.on('manage request', function (data) {
		if (data.status == 'accept') {
			let roomIndex = _.findIndex(rooms,{id:data.roomName});
			fullroomdata = GetFullRoomData(roomIndex);
			var playerListLength = Object.keys(rooms[roomIndex]['playerList']).length;
			var user_ids = [];
			if (playerListLength > 0) {
				var user_ids = Object.keys(rooms[roomIndex]['playerList']).map(function (key) {
					return rooms[roomIndex]['playerList'][key];
				});
			}
			var roomCreator = user_ids.length > 0 ? user_ids[0] : 0;
			io.in(data.roomName).emit('manage response', { 'status': true, 'message': "Request accepted", data: roomCreator });

		} else {
			io.in(data.roomName).emit('manage response', { 'status': false, 'message': "Request rejected", data: data });
		}
	})
	socket.on("JoinRoom", (data) => {
		var _userId = data.user_id ? "user" + data.user_id : "user0";
		let userIndex = _.findIndex(connected_user, { user_id: socket.user_id });
		if(connected_user[userIndex].isInRoom === false){
			let roomIndex = _.findIndex(rooms,{id:data.roomName});
			if (rooms[roomIndex] >= 0) {
				if (rooms[roomIndex]["playerList"] && Object.keys(rooms[data.roomName]["playerList"]).length < GetMaxAllowedPlayersInRoom(roomIndex)) {
					socket.join(data.roomName);
					rooms[roomIndex]["playerList"][_userId] = socket.user_id;
					player_room[_userId] = roomIndex;
					fullroomdata = GetFullRoomData(data.roomName);
					if (Object.keys(rooms[roomIndex]['playerList']).length == GetMaxAllowedPlayersInRoom(roomIndex)) {
						setRoomOptions(roomIndex);
						var user_ids = [];
						var user_ids = Object.keys(rooms[data.roomName]['playerList']).map(function (key) {
							return rooms[data.roomName]['playerList'][key];
						});
						manageUserStatus(user_ids, STATUS.playing);
						io.in(data.roomName).emit('OnGameStarted', { 'status': true, 'message': "Game Started", room: fullroomdata });
					}
					socket.emit('OnJoinedRoom', { 'status': true, 'message': "Player joined room", room: fullroomdata, playerId: data.user_id });
					io.in(data.roomName).emit('OnPlayerConnected', { 'status': true, 'message': "Player joined room", room: fullroomdata, playerId: data.user_id });
				}else{
					socket.emit('OnJoinRoomFailed', { 'status': false, 'message': "Room is full" });
				}
			}else{
				socket.emit('OnJoinRoomFailed', { 'status': false, 'message': "Room doesn't exist" });
			}	
		}else{
			socket.emit('OnJoinRoomFailed', { 'status': false, 'message': "Player already in room" });
		}
	});

	socket.on("GetRoomList", () => {
		var open_rooms = Array();
		for (roomId in rooms) {
			let temp_room = {};
			if (((rooms[roomId] && rooms[roomId]['playerList']) || (rooms[roomId] && rooms[roomId]['playerList'] && Object.keys(rooms[roomId]['playerList']).length < GetMaxAllowedPlayersInRoom(roomId)))
				&& rooms[roomId]['roomOptions'].isOpen
				&& rooms[roomId]['roomOptions'].isVisible
				&& !rooms[roomId]['roomOptions'].gameStarted) {
				temp_room['id'] = rooms[roomId]['id'];
				temp_room['playerCount'] = Object.keys(rooms[roomId]['playerList']).length;
				temp_room['maxPlayers'] = rooms[roomId]['roomOptions']['maxPlayers'];
				temp_room['customRoomProperties'] = rooms[roomId]['roomOptions']['customRoomProperties'];
				open_rooms.push(temp_room);
			}
		}
		socket.emit('GetRoomList', { rooms: open_rooms });
	});

	socket.on("SetPlayerCustomProperties", (data) => {
		var _userId = data.user_id ? "user" + data.user_id : "user0";
		if (!player[_userId]) player[_userId] = {};
		for (var key in data) {
			player[_userId][key] = data[key];
		}
	});

	socket.on("LeaveRoom", (data) => {
		let _userId = socket.user_id ? "user" + socket.user_id : "user0";
		let room = player_room[_userId] && rooms[player_room[_userId]]? rooms[player_room[_userId]]:null;
		if (room) {
			let roomIndex = player_room[_userId];
			let roomName = room.id;
			socket.leave(roomName);
			manageUserStatus(data.user_id, 'online');
			if (rooms[roomIndex] && rooms[roomIndex]['playerList'] && rooms[roomIndex]['playerList'][_userId])
				delete rooms[roomIndex]['playerList'][_userId];
			if (Object.keys(rooms[roomIndex]['playerList']).length == 0) {
				delete rooms[roomIndex];
			}else{
				fullroomdata = GetFullRoomData(roomIndex);
				io.in(roomName).emit('OnPlayerDisconnected', { 'status': true, 'messsage': 'Player left room', room: fullroomdata, playerId: data.user_id });
			}
			delete player_room[_userId];
			socket.emit('OnLeftRoom', { 'status': true, 'message': 'Player left room', room: room, playerId: data.user_id });
		}
	});

	socket.on('Message', function (data) {
		if (data.data)
			socket.to(data.data.roomName).emit(data.methodName, data.data);
		else
			socket.to(data.roomName).emit(data.methodName);
	});

	socket.on('MessageToAll', function (data) {
		if (data.data) {
			io.in(data.data.roomName).emit(data.methodName, data.data);
		}
		else {
			io.in(data.roomName).emit(data.methodName);
		}
	});
});

function GetFullRoomData(roomIndex) {
	let room = rooms[roomIndex] ? rooms[roomIndex] : null;
	if (room) {
		fullroomdata = room;
		fullroomdata['playerList'] = Array();
		for (var key in room['playerList']) {
			if (player[key])
				fullroomdata['playerList'].push({ id: player[key].user_id, customPlayerProperties: player[key] });
			else 
				fullroomdata['playerList'][key] = '';
		}
		return fullroomdata;
	}
	return '';
}


function sendRequest(data,socket,roomName){
	let userIndex = _.findIndex(connected_user, { user_id: data.user_id2 });
	if (connected_user[userIndex] && connected_user[userIndex].status != 'playing' && connected_user[userIndex].status != 'offline') {
		models.User.findById(data.user_id, { attributes: ['id', 'username'] }).then(user => {
			if (user) {
				var responseData = { 'status': true, 'message': "room created", data: { user: user, roomName: roomName } };
				io.to(connected_user[userIndex].socket_id).emit('challenge request', responseData);
			} else {
				var responseData = { 'status': false, 'message': "User not found", data: {} };
				io.to(connected_user[userIndex].socket_id).emit('challenge request', responseData);
			}
		});
	} else {
		socket.emit('challenge request', { 'status': false,'message': "Challenging user is Offline or Playing with other.", data:{}});
	}
	
}

function setRoomOptions(roomIndex){
	roomOptionsStart = {
		'isVisible': false,
		'isOpen': false,
		'gameStarted': true,
		'maxPlayers': rooms[roomIndex]['roomOptions']['maxPlayers'],
		'customRoomProperties': rooms[roomIndex]['roomOptions']['customRoomProperties'],
	};
	rooms[roomIndex]['roomOptions'] = roomOptionsStart;
}

function GetMaxAllowedPlayersInRoom(roomIndex) {
	if (rooms[roomIndex] && rooms[roomIndex]['roomOptions']  && rooms[roomIndex]['roomOptions']['maxPlayers']) {
		return rooms[roomIndex]['roomOptions']['maxPlayers'];
	}
	return 0;
}

function manageUserStatus(user_id, status) {
	user_id = Array.isArray(user_id) ? user_id : [user_id];

	user_id.forEach(function (user) {
		let userIndex = _.findIndex(connected_user, { user_id: user_id });

		if (userIndex >= 0)
			connected_user[userIndex].status = status;
	});
	models.User.update({ status: status }, { where: { id: { $in: user_id } } });
}

