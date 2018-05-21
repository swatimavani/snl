var express = require('express');
var router = express();
var passport = require('passport');
const expressJwt = require('express-jwt');
var common = require('../common');
var config = common.config;
const authenticate = expressJwt({secret : config.secret});    
var checkAuthentication = require("../middleware/authenticate.js");

var user_controller = require('../controllers/userController');
var friend_controller = require('../controllers/friendController');

router.post('/user/login',user_controller.login);
router.post('/user/store-device-details',user_controller.storeUserDeviceDetails);
router.get('/user/logout',authenticate,checkAuthentication.isExpire,user_controller.logout);
router.post('/user/online-playing',user_controller.getOnlineAndPlayingUsers);
router.post('/user/update',user_controller.updateUserData);


/* Route for friend controller */

router.post('/friend/send-request',authenticate,checkAuthentication.isExpire,friend_controller.sendRequest);
router.get('/friend/list',authenticate,checkAuthentication.isExpire,friend_controller.friendList);
router.post('/friend/handle-friend-request',authenticate,checkAuthentication.isExpire,friend_controller.handleFriendRequest);

module.exports = router;
