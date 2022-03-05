const tmi = require('tmi.js');
const axios = require('axios');
require('dotenv').config();

var BlizzardAuthToken;
var playerDictionary = {};
let client;

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
	if(self || !message.startsWith('!')) return;

	const args = message.slice(1).split(' ')
	const command = args.shift().toLowerCase();
	console.log(args)
	if(command === 'blizz'){
		//TODO need to do index checking
		let playerInfo = args[0].toLowerCase().split("-");
		if(playerInfo.length != 2){
			console.log("Invalid player arg count")
			return;
		}
		if( playerInfo[0]+playerInfo[1] in playerDictionary){
			console.log("retrieved from cache");
			client.say(channel, `@${tags.username}, you have: ${playerDictionary[playerInfo[0]+playerInfo[1]]} achievement points!`);
			return;
		}
		formBody = getAuthBody();
		if(BlizzardAuthToken == undefined){
			axios.post('https://us.battle.net/oauth/token',
		       formBody,
		       {headers: {'content-type':'application/x-www-form-urlencoded'}})
			//wait for a response from the blizzard auth API
			.then((response) => {
		      if(response['status'] == 200){
		      	console.log('have a good response from blizzard auth endpoint')
		      	BlizzardAuthToken =  response['data']['access_token']
		      	return response['data']['access_token']
		      }
		      else{
		      	console.log("Failed to get an auth token from blizzard, maybe add a retry here at some point.")
		      	return;
		      }
			})
			//Now go get the achievement information
			.then((AuthToken) =>{
				var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[0]+'/'+playerInfo[1]+'/achievements';
				return axios.get(getURL,{params:{namespace : 'profile-us',
					locale : 'en_US',
					access_token : AuthToken}})
			})						
			//wait for a response from the blizzard achievement API				
			.then((response) =>{
					playerDictionary[playerInfo[0]+playerInfo[1]] = response['data']['total_points'];
					return(response['data']['total_points'])
			})
			.then((achievementPoints) =>{
				client.say(channel, `@${tags.username}, you have: ${achievementPoints} achievement points!`);
			})
			.catch((error) => {
			    console.log(error);
			});
		}else{
			var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[0]+'/'+playerInfo[1]+'/achievements';
			axios.get(getURL,{params:{namespace : 'profile-us',
					locale : 'en_US',
					access_token : BlizzardAuthToken}
			})				
			//wait for a response from the blizzard achievement API				
			.then((response) =>{
					playerDictionary[playerInfo[0]+playerInfo[1]] = response['data']['total_points'];
					return(response['data']['total_points'])
			})
			.then((achievementPoints) =>{
				client.say(channel, `@${tags.username}, you have: ${achievementPoints} achievement points!`);
			});
		}

	}
	if(command === 'echo') {
		client.say(channel, `@${tags.username}, you said: "${args.join(' ')}"`);
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

/*function GetAchievementInfoCall(playerargs,authToken){
	
	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[0]+'/'+playerInfo[1]+'/achievements';

	axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : authToken}})
	.then(function (response){
		console.log(response);
		return(response['data']['total_points'])
	})


}*/

//https://us.api.blizzard.com/profile/wow/character/thrall/xtrimity/achievements?namespace=profile-us&locale=en_US&access_token=US30v7CkxCyBGFgi5H9K71QgZeQreTQVu4





