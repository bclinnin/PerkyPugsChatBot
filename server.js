const tmi = require('tmi.js');
const axios = require('axios');
const axiosRetry = require('axios-retry');
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
let currentRaffleList = [];
let currentRaffleTwitchName = [];
let global_playerFactionDictionary = {};
let global_playerToTwitchNameDictionary = {};
let modList = process.env.MOD_LIST;
let timeWindowForThrottle = new Date();
let messagesInThrottleWindow = 0;
let messageThrottleId;
let messageBufferSuccessfulEnter = [];
let messageBufferAlreadyEntered = [];
let messageBufferCanOnlyEnterOnce = [];
let messageBufferWrongName = [];
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

//Configure axios retry for potential throttling from blizzard
axiosRetry(axios, { retries: 3 });
axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
axiosRetry(axios, {retryCondition: (error)=>{return error.response['status'] === 429}});

//Configure the message throttling service
setInterval(SendMessageBuffer, 2500, messageBufferSuccessfulEnter, ` you are entered.`);
setInterval(SendMessageBuffer, 2500, messageBufferAlreadyEntered, ` you are already entered in the current raffle.`);
setInterval(SendMessageBuffer, 2500, messageBufferCanOnlyEnterOnce, ` you may only enter one character in the raffle.`);
setInterval(SendMessageBuffer, 2500, messageBufferWrongName, ` I couldn't find that character, please ensure that you are giving character-realm. Character name should include any alt codes for special characters.`);

global_client.on('message', (channel, tags, message, self) => {
	try{
		if(self || !message.startsWith('!')) return;
		//map channel to global scope for simplicity
		globalChannel=channel;
	
		const args = message.slice(1).trim().split(/\s+/);
		const command = args.shift().toLowerCase();

		//route the command to the appropriate handler
		switch(command){
			case 'echo':
				if(!DoesUserHaveAdminPermissions(tags))return;
				HandleEchoCommand(args,tags);
				break;
			case 'setwinners':
				if(!DoesUserHaveAdminPermissions(tags))return;
				HandleSetWinnersCommand(args,tags);
				break;
			case 'enter':
				HandleEnterCommand(args,tags);
				break;
			case 'openraffle':
				if(!DoesUserHaveAdminPermissions(tags))return;
				HandleOpenRaffleCommand(args,tags);
				break;	
			case 'closeraffle':
				if(!DoesUserHaveAdminPermissions(tags))return;
				HandleCloseRaffleCommand(args,tags);
				break;
			case 'getwinners':
				if(!DoesUserHaveAdminPermissions(tags))return;
				if(isRaffleOpen)return;
				global_currentWinnerCount = 0;
				HandleGetWinnersCommand(args,tags);	
				break;
			case 'help':
				if(!DoesUserHaveAdminPermissions(tags))return;
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
	!echo 'test string to return'  ||||||  
	!setwinners 'number of winners'  ||||||  
	!enter 'character'-'realm'  ||||||  
	!openraffle  ||||||  
	!closeraffle  ||||||  
	!getwinners  ||||||  
	!help`);
}

function HandleEchoCommand(args,tags){
	global_client.say(globalChannel, `@${tags.username}, you said: "${args.join(' ')}"`);
}

function HandleCloseRaffleCommand(args,tags){
	//check if raffle is already closed
	if(!isRaffleOpen){
		global_client.say(globalChannel, `The raffle is already closed`);
		return;
	}
	isRaffleOpen = false;
	global_currentWinnerCount = 0;
	global_client.say(globalChannel, `The raffle is now closed`);
}

//This will create a recursive chain of promises that will terminate when ANY of the following base cases are met
// - the currentRaffleList array has had all items exhausted
// - the number of desired winners have been randomly selected AND have passed validations
function HandleGetWinnersCommand(args,tags){
	if(isRaffleOpen)return;

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
	})
	.catch((error) => {
		//if(debug)console.log(error);
		global_client.say(globalChannel, `An error was encountered while attempting to determine the winners.`);
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
	//check if raffle is already open
	if(isRaffleOpen){
		global_client.say(globalChannel, `The raffle is already open`);
		return;
	}
	//clear out the current list of entrants such that they must re-enter for each raffle
	currentRaffleList = [];
	currentRaffleTwitchName = [];
	isRaffleOpen = true;
	global_client.say(globalChannel, `The raffle is now open`);
}

function ValidateAndParseCharacterInfo(args){
	//I kind of hate this, but this is what currently allows players to enter the entire
	//Realm name with whitespace and special characters included, but have it still work with the wowAPI
	try{
	//merge the array back together
	var combined = args.join(" ");

	//scrape the character name
	var splitByHyphen = combined.split('-');
	var characterName = splitByHyphen.shift().toLowerCase();

	var remainingRealmInfo = splitByHyphen.join(''); //just join back together, but don't add anything back in
	var realmNoWhitespace = remainingRealmInfo.replaceAll(" ","-"); // get rid of realm whitespace for wow API by replacing all spaces with dashes
	var realmNoWhiteSpaceNoSpecialChar = realmNoWhitespace.replaceAll('\'','').toLowerCase(); //lowercase it and get rid of apostrophes\

	return [characterName,realmNoWhiteSpaceNoSpecialChar];

	}
	catch(error){
		//console.log(error);
	}
	
}

function HandleEnterCommand(args,tags){
	//raffle must be open to allow new players to enter
	if(!isRaffleOpen)return;

	var charAndRealm = ValidateAndParseCharacterInfo(args);
	
	var realmAndCharacterName = charAndRealm.join('_');
	var realm = charAndRealm[1];
	var character = charAndRealm[0];

	//players can only enter the raffle once
	if (currentRaffleList.includes(realmAndCharacterName)){
		messageBufferAlreadyEntered.push(tags.username);
		return;
	}
	
	if (!CanTwitchAccountEnterInRaffle(tags)){
		messageBufferCanOnlyEnterOnce.push(tags.username);
		return;
	}

	Promise.resolve(RequestAuthToken())
	//Grab character summary and register them for raffle if they exist
	.then(() => {return FetchPlayerSummary(realm,character)})
	.then((characterSummary) => {return RegisterPlayerForRaffle(characterSummary,realmAndCharacterName,tags)})
	.catch((error) => {
		messageBufferWrongName.push(tags.username);
	});	
}

function CanTwitchAccountEnterInRaffle(tags){
	//admins can enter multiple characters from a single twitch user
	//everyone else can only enter one character per twitch user
	if(DoesUserHaveAdminPermissions(tags)){
		return true;
	}
	if(!currentRaffleTwitchName.includes(tags.username)){
		return true;
	}
	return false;
}

function RegisterPlayerForRaffle(characterSummary,realmAndCharacterName,tags){
	var playerFaction = characterSummary['data']['faction']['type'];

	if(characterSummary['data']['level'] != 60){
		global_client.say(globalChannel, `@${tags.username}, The character you entered must be level 60!`);
		return;
	}
	if(currentRaffleList.includes(realmAndCharacterName)){
		console.log('race condition met of player entering multiple times quickly');
		return;
	}
	if (!CanTwitchAccountEnterInRaffle(tags)){
		return;
	}

	//we need to store a dictionary of player->faction
	global_playerFactionDictionary[realmAndCharacterName] = playerFaction;

	//store the player's twitch name in case they win
	global_playerToTwitchNameDictionary[realmAndCharacterName] = tags.username;

	currentRaffleList.push(realmAndCharacterName);
	currentRaffleTwitchName.push(tags.username);	
	messageBufferSuccessfulEnter.push(tags.username);
}

function FetchPlayerSummary(realm,character){
	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+realm+'/'+character;
	return axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : global_BlizzardAuthToken}})

}

function HandleSetWinnersCommand(args,tags){
	if (args.length != 1){
		console.log('incorrect args sent to setwinners command');
		global_client.say(globalChannel, `@${tags.username}, please provide only two arguments to the setwinners command. ex: \"!setwinners 15\"`);
		return;
	}
	global_desiredWinnerCount = parseInt(args[0]);
	global_client.say(globalChannel, `${global_desiredWinnerCount} players will be able to win in the next raffle!`);
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

function RequestAuthToken(){
	//if we already have a token, just return the auth string
	//TODO: handle auth token expiration, track token receive time so that we reauth when expired (1day token life)
	if(global_BlizzardAuthToken != undefined) return global_BlizzardAuthToken;
	
	//TODO promise chain should have exception handling
	let formBody = getAuthBody();	
	return Promise.resolve(axios.post('https://us.battle.net/oauth/token',
	formBody,
	{headers: {'content-type':'application/x-www-form-urlencoded'}}))
	.then((response) => {return HandleAuthResponse(response)});
}
function HandleAuthResponse(response){
	if(response['status'] == 200){
		//if(debug)console.log('have a good response from blizzard auth endpoint')
		global_BlizzardAuthToken =  response['data']['access_token']
		return response['data']['access_token']
	}
	else{
		if(debug)console.log("Failed to get an auth token from blizzard, maybe add a retry here at some point.")
		return;
	}
}

function FetchPlayerMounts(playerInfo){
	if(playerInfo == null)return;
	//playerinfo comes in the form character.realm here right now
	playerInfo = playerInfo.toLowerCase().split("_");

	//playerInfo[1] contains the realm
	//playerInfo[0] contains the character name
	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[1]+'/'+playerInfo[0]+'/collections/mounts';
	return axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : global_BlizzardAuthToken}})	
}

function FindMountInCollection(playerMountCollection){
	if(playerMountCollection == null)return;
	for(var mount of playerMountCollection['data']['mounts']){
		if(mount['mount']['id']==process.env.AOTC_MOUNT_ID)return true;
	}
	return false;
}

function DeterminePlayerEligibility(selectedWinner,doesPlayerHaveMount){
	if(selectedWinner == null)return;
	if(doesPlayerHaveMount){
		global_client.say(globalChannel, `@${global_playerToTwitchNameDictionary[selectedWinner]} already has the mount and is NOT eligible for a carry!`);
	}
	else{
		global_client.say(globalChannel, `@${global_playerToTwitchNameDictionary[selectedWinner]} has won a carry with character {{${selectedWinner.replace('_','-')}}} on ${global_playerFactionDictionary[selectedWinner]} ! ${modList}`);
		global_currentWinnerCount++;
	}
}

function DoesUserHaveAdminPermissions(tags){
	if(tags == null)return false;
	if(tags.badges == null)return false;
	if('broadcaster' in tags.badges){
		//This is the streamer, grant them access
		return true;
	}
	if(tags.mod === true){
		//This is a moderator, grant them access
		return true;
	}
	return false;
}

function CanSendMessage(){
	var currentTime = new Date();
	var diff = ( currentTime.getTime() - timeWindowForThrottle.getTime() ) / 1000; //seconds between throttle window and current time
	if(diff > 45){
		timeWindowForThrottle = currentTime; //reset the window if it has been a minute
		messagesInThrottleWindow = 0;
	}
	if(messagesInThrottleWindow < 70){
		console.log('messages in current time window: '+messagesInThrottleWindow);
		return true;
	}
	return false;
}

function SendMessageBuffer(buffer,message){
	if(buffer.length == 0) return;
	if(!CanSendMessage()) return; //don't drain the buffer if we are already at message quota

	var usersPerMessage = 10;
	var count = 0;
	var userListString = '';
	while((buffer.length > 0) && (count < usersPerMessage)){
		userListString += '@'+buffer.shift() + ' '; 
	}	
	if(userListString != ''){
		messagesInThrottleWindow++;
		global_client.say(globalChannel, userListString+message);
	}
}