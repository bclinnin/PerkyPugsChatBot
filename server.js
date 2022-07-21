const tmi = require('tmi.js');
const axios = require('axios');
require('dotenv').config();

//~~~~ Globals
var global_BlizzardAuthToken;
var playerDictionary = {};
let global_client;
let debug = new Boolean(process.env.DEBUG_MODE);
let isRaffleOpen = false;
let global_currentWinnerCount = 0;
let global_desiredWinnerCount = 10;
let globalChannel;
let adminDict = {'Doom1024':1};//TODO: make this a config argument on the heroku container startup. using dict for fast lookup
let currentRaffleList = [];
//~~~~ END Globals

//client Connection Startup
if( !global_client){
	global_client = new tmi.Client({
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
global_client.connect();

global_client.on('message', (channel, tags, message, self) => {
	try{
		if(self || !message.startsWith('!')) return;
		//map channel to global scope for simplicity
		globalChannel=channel;
	
		const args = message.slice(1).split(' ');
		const command = args.shift().toLowerCase();
		if(debug)console.log(args);

		//route the command to the appropriate handler
		switch(command){
			case 'blizz':
				HandleBlizzCommand(args,tags);
				break;
			case 'echo':
				global_client.say(globalChannel, `@${tags.username}, you said: "${args.join(' ')}"`);
				break;
			case 'setwinners':
				HandleSetWinnersCommand(args,tags);
				break;
			case 'enter':
				HandleEnterCommand(args,tags);
				break;
			/*case 'showraffle':
				HandleShowRaffleCommand(args,tags);	
				break;*/
			case 'openraffle':
				HandleOpenRaffleCommand(args,tags);
				break;	
			case 'closeraffle':
				HandleCloseRaffleCommand(args,tags);
				break;
			case 'getwinners':
				HandleGetWinnersCommand(args,tags);	
				break;
			case 'help':
				HandleHelpCommand(args,tags);
				break;		
			default:
				break;								
		}
	}
	catch(err){
		console.log("outer command level error - "+err);
	}	
});

function HandleHelpCommand(args,tags){
	global_client.say(globalChannel, `The following commands are accepted.  ||||||  
	!blizz 'realm'-'character'  ||||||  
	!echo 'test string to return'  ||||||  
	!setwinners 'number of winners'  ||||||  
	!enter 'realm'-'character'  ||||||  
	!openraffle  ||||||  
	!closeraffle  ||||||  
	!help`);
}

function HandleCloseRaffleCommand(args,tags){
	//this is an admin command, user must be in the allowlist to execute this
	if(!tags.username.toLowerCase in adminDict){
		if(debug)console.log('user did not have permission to execute command');
		return;
	}

	//check if raffle is already closed
	if(!isRaffleOpen){
		global_client.say(globalChannel, `The raffle is already closed`);
		return;
	}
	isRaffleOpen = false;
	global_currentWinnerCount = 0;
	global_client.say(globalChannel, `The raffle is now closed`);
	//CalculateWinners(args,tags);
}

//This will create a recursive chain of promises that will terminate when ANY of the following base cases are met
// - the currentRaffleList array has had all items exhausted
// - the number of desired winners have been randomly selected AND have passed validations
function HandleGetWinnersCommand(args,tags){
	var trackedwinner;
	Promise.resolve(RequestAuthToken())
	.then(()=>{return SelectWinnerFromList()})
	.then((winner)=>{
		trackedwinner = winner;
		return FetchPlayerMounts(winner)})
	.then((playerMountCollection)=>{return FindMountInCollection(playerMountCollection)})
	.then((doesPlayerHaveMount) => {return DeterminePlayerEligibility(trackedwinner,doesPlayerHaveMount)})
	.then(()=>{
		if(!ShouldContinueDrawingWinners())return;
		return HandleGetWinnersCommand(args,tags);
	});
}

function ShouldContinueDrawingWinners(){
	//handle the case of our list being exhausted
	if(currentRaffleList.length == 0){
		global_client.say(globalChannel, `There are no more potential winners to be chosen`);
		return false;
	}
	if(global_currentWinnerCount >= global_desiredWinnerCount){
		global_client.say(globalChannel, `The max number of winners for this run has been reached!`);
		return false;
	}
	return true;
}

function CalculateWinners(args,tags){
	let currentWinnerCount = 0;
	//TODO: this looping doesn't work quite right.  The entire thing needs to be an async promise chain, not just the winner eligibility logic
	while(currentRaffleList.length > 0 && currentWinnerCount < global_desiredWinnerCount){
		var selectedWinner = SelectWinnerFromList();
		Promise.resolve(RequestAuthToken())
		.then(()=>{return FetchPlayerMounts(selectedWinner)})
		.then((playerMountCollection)=>{return FindMountInCollection(playerMountCollection)})
		.then((doesPlayerHaveMount) => {return DeterminePlayerEligibility(selectedWinner,doesPlayerHaveMount)});
	
		currentWinnerCount++;
	}
}

function SelectWinnerFromList(){
	//handle the case of our list being exhausted
	if(currentRaffleList.length == 0){
		global_client.say(globalChannel, `There are no more potential winners to be chosen`);
	}

	//randomly select an element from our entered players list
	const indexOfWinner = Math.floor(Math.random()*currentRaffleList.length);
	var winner = currentRaffleList[indexOfWinner];
	console.log(winner)
	//remove this player from the list so they cannot be selected again
	currentRaffleList.splice(indexOfWinner,1);

	return winner;	
}

function HandleOpenRaffleCommand(args,tags){
	//this is an admin command, user must be in the allowlist to execute this
	if(!tags.username.toLowerCase in adminDict){
		if(debug)console.log('user did not have permission to execute command');
		return;
	}

	//check if raffle is already open
	if(isRaffleOpen){
		global_client.say(globalChannel, `The raffle is already open`);
		return;
	}
	//clear out the current list of entrants such that they must re-enter for each raffle
	currentRaffleList = [];
	isRaffleOpen = true;
	global_client.say(globalChannel, `The raffle is now open`);
}

function HandleShowRaffleCommand(args,tags){
	for(var index in currentRaffleList){
		console.log('Entered player - ' + currentRaffleList[index]);
	}
}

function HandleEnterCommand(args,tags){
	//raffle must be open to allow new players to enter
	if(!isRaffleOpen)return;

	//we should have exactly 1 argument
	if(args.length !=1){
		console.log('only one name should be supplied to this command');
		return;
	}
	
	//players can only enter the raffle once
	if (currentRaffleList.includes(args[0])){
		return;
	}

	//add them to the list
	console.log(args[0]);
	currentRaffleList.push(args[0]);
}

function HandleSetWinnersCommand(args,tags){
	if (args.length != 1){
		console.log('incorrect args sent to setwinners command');
		//TODO: maybe make this whisper the person who issued the admin command instead of channel broadcasting
		global_client.say(globalChannel, `@${tags.username}, please provide only two arguments to the setwinners command. ex: \"!setwinners 15\"`);
		return;
	}
	global_desiredWinnerCount = ParseInt(args[0]);
	//TODO:announce to the channel the new winner count
}

function HandleBlizzCommand(args,tags){
	//TODO need to do index checking
	let playerInfo = args[0].toLowerCase().split("-");
	
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
		global_client.say(globalChannel, `@${tags.username}, you have: ${achievementPoints} achievement points!`);
	})
	.catch((error) => {
		if(debug)console.log(error);
		global_client.say(globalChannel, `@${tags.username}, I couldn't find that charater, please ensure that you are giving realm-character. Character should include all special characters.`);
	});
}

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
		global_client.say(globalChannel, `@${tags.username}, you have: ${playerDictionary[playerInfo[0]+playerInfo[1]]} achievement points!`);
		return true;
	}
	return false;
}
function RequestAuthToken(){
	//if we already have a token, just return the auth string
	//TODO: handle auth token expiration, track token receive time so that we reauth when expired (1day token life)
	if(global_BlizzardAuthToken != undefined) return global_BlizzardAuthToken;
	
	let formBody = getAuthBody();	
	return Promise.resolve(axios.post('https://us.battle.net/oauth/token',
	formBody,
	{headers: {'content-type':'application/x-www-form-urlencoded'}}))
	.then((response) => {return HandleAuthResponse(response)});
}
function HandleAuthResponse(response){
	if(response['status'] == 200){
		if(debug)console.log('have a good response from blizzard auth endpoint')
		global_BlizzardAuthToken =  response['data']['access_token']
		return response['data']['access_token']
	}
	else{
		if(debug)console.log("Failed to get an auth token from blizzard, maybe add a retry here at some point.")
		return;
	}
}

function fetchPlayerAchievementPoints(AuthToken,playerInfo){
	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[0]+'/'+playerInfo[1]+'/achievements';
	return axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : AuthToken}})
}

function FetchPlayerMounts(playerInfo){
	if(playerInfo == null)return;
	//playerinfo comes in the form realm-character here right now
	playerInfo = playerInfo.toLowerCase().split("-");

	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[0]+'/'+playerInfo[1]+'/collections/mounts';
	return axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : global_BlizzardAuthToken}})	
}

function FindMountInCollection(playerMountCollection){
	if(playerMountCollection == null)return;
	console.log(playerMountCollection);
	for(var mount of playerMountCollection['data']['mounts']){
		if(mount['mount']['id']==process.env.AOTC_MOUNT_ID)return true;
	}
	return false;
}

function DeterminePlayerEligibility(selectedWinner,doesPlayerHaveMount){
	if(selectedWinner == null)return;
	if(doesPlayerHaveMount){
		global_client.say(globalChannel, `@${selectedWinner} already has the mount and is NOT eligible for a carry!`);
	}
	else{
		global_client.say(globalChannel, `@${selectedWinner} has won a carry!`);
		global_currentWinnerCount++;
	}
}

function addPlayerAchievementInfoToDictionary(playerInfo,profileResponse){
	//key into dictionary on combination of player realm and name
	playerDictionary[playerInfo[0]+playerInfo[1]] = profileResponse['data']['total_points'];
	return(profileResponse['data']['total_points'])
}