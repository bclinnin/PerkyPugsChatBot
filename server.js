const tmi = require('tmi.js');
const axios = require('axios');
require('dotenv').config();

//~~~~ Globals
var BlizzardAuthToken;
var playerDictionary = {};
let client;
let debug = new Boolean(process.env.DEBUG_MODE);
let globalChannel;
let adminList = ['Doom1024'];//TODO: make this a config argument on the heroku container startup
let currentRaffleList = [];
//~~~~ END Globals

//Client Connection Startup
if( !client){
	client = new tmi.Client({
	connection:{
		reconnect:true
	},
	identity:{
		username: process.env.TWITCH_BOT_USERNAME,
		password: process.env.TWITCH_BOT_PASSWORD
	},
	channels: [ process.env.TWITCH_CHANNEL_NAME ]
});
}
client.connect();

client.on('message', (channel, tags, message, self) => {
	try{
		if(self || !message.startsWith('!')) return;
		//map channel to global scope for simplicity
		globalChannel=channel;
	
		const args = message.slice(1).split(' ');
		const command = args.shift().toLowerCase();
		console.log(args)
		if(command === 'blizz'){
			//TODO need to do index checking
			let playerInfo = args[0].toLowerCase().split("-");
	
			//TODO : This is returning the chat message twice right now
			if(!IsPlayerInfoValid(playerInfo))return;
			if(IsPlayerInCache(playerInfo,tags))return;
						
			//wait for a response from the blizzard auth API
			Promise.resolve(RequestAuthToken())
			//Now go get the achievement information
			.then((AuthToken) => {return fetchPlayerAchievementPoints(AuthToken,playerInfo)})
			//wait for a response from the blizzard achievement API
			.then((profileResponse) =>{
				addPlayerAchievementInfoToDictionary(playerInfo,profileResponse);
				return(profileResponse['data']['total_points']);
			})
			.then((achievementPoints) =>{
				client.say(globalChannel, `@${tags.username}, you have: ${achievementPoints} achievement points!`);
			})
			.catch((error) => {
				console.log(error);
				client.say(globalChannel, `@${tags.username}, I couldn't find that charater, please ensure that you are giving realm-character. Character should include all special characters.`);
			});
	
		}
		if(command === 'echo') {
			client.say(globalChannel, `@${tags.username}, you said: "${args.join(' ')}"`);
		}
		if(command === 'setwinners'){
			if (args.length != 1){
				console.log('incorrect args sent to setwinners command');
				//TODO: maybe make this whisper the person who issued the admin command instead of channel broadcasting
				client.say(globalChannel, `@${tags.username}, please provide only two arguments to the setwinners command. ex: \"!setwinners 15\"`);
				return;
			}
		}

		if(command === 'enter'){
			//we should have exactly 1 argument
			if(args.length !=1){
				console.log('only one name should be supplied to this command');
				return;
			}
			//let playerInfo = args[0].toLowerCase().split("-");
			if (currentRaffleList.includes(args[0])){
				return;
			}
			console.log(args[0]);
			currentRaffleList.push(args[0]);
			
		}
		if(command === 'showraffle'){    
			for(var index in currentRaffleList){
				console.log('Entered player - '+currentRaffleList[index]);
			}
		}
	}
	catch(err){
		console.log("outer command level error - "+err);
	}
	
});

function getAuthBody(){
	var details = {
	client_id: process.env.BLIZZARD_CLIENTID,
	client_secret: process.env.BLIZZARD_CLIENTSECRET,
	grant_type: 'client_credentials'};

	var formBody = [];
	for (var property in details) {
	  var encodedKey = encodeURIComponent(property);
	  var encodedValue = encodeURIComponent(details[property]);
	  formBody.push(encodedKey + "=" + encodedValue);
	}
	formBody = formBody.join("&");
	return formBody;
}
function IsPlayerInfoValid(playerInfo){
	if(playerInfo.length != 2){
		if(debug)console.log("Invalid player arg count")
		return false;
	}
	return true;
}

function IsPlayerInCache(playerInfo,tags){	
	if( playerInfo[0]+playerInfo[1] in playerDictionary){
		if(debug)console.log("retrieved from cache");
		client.say(globalChannel, `@${tags.username}, you have: ${playerDictionary[playerInfo[0]+playerInfo[1]]} achievement points!`);
		return true;
	}
	return false;
}
function RequestAuthToken(){
	//if we already have a token, just return the auth string
	if(BlizzardAuthToken != undefined) return BlizzardAuthToken;
	
	let formBody = getAuthBody();	
	return Promise.resolve(axios.post('https://us.battle.net/oauth/token',
	formBody,
	{headers: {'content-type':'application/x-www-form-urlencoded'}}))
	.then((response) => {return HandleAuthResponse(response)});
}
function HandleAuthResponse(response){
	if(response['status'] == 200){
		console.log('have a good response from blizzard auth endpoint')
		BlizzardAuthToken =  response['data']['access_token']
		return response['data']['access_token']
	}
	else{
		console.log("Failed to get an auth token from blizzard, maybe add a retry here at some point.")
		return;
	}
}

function fetchPlayerAchievementPoints(AuthToken,playerInfo){
	console.log("current auth token "+AuthToken);
	console.log("current logged player "+playerInfo);
	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[0]+'/'+playerInfo[1]+'/achievements';
	return axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : AuthToken}})
}

function addPlayerAchievementInfoToDictionary(playerInfo,profileResponse){
	//key into dictionary on combination of player realm and name
	playerDictionary[playerInfo[0]+playerInfo[1]] = profileResponse['data']['total_points'];
	return(profileResponse['data']['total_points'])
}