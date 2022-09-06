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
let timeWindowForThrottle;
let messagesInThrottleWindow = 0;
let messageThrottleId;
let messageBufferSuccessfulEnter = [];
let messageBufferAlreadyEntered = [];
let messageBufferCanOnlyEnterOnce = [];
let messageBufferWrongName = [];
const MessagePriority = {
	Low: 0,
	Medium: 1,
	High: 2
}
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
axiosRetry(axios, { retries: 10 });
axiosRetry(axios, { retryDelay: axiosRetry.exponentialDelay });
axiosRetry(axios, {retryCondition: (error)=>{
	if(error.response == undefined){
		console.log('undefined response, retrying');
		return true;
	}
console.log('retry condition status '+error.response['status']); return error.response['status'] === 429}});

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
	var message = `The following commands are accepted.  ||||||  
	!echo 'test string to return'  ||||||  
	!setwinners 'number of winners'  ||||||  
	!enter 'character'-'realm'  ||||||  
	!openraffle  ||||||  
	!closeraffle  ||||||  
	!getwinners  ||||||  
	!help`;
	SendMessage(MessagePriority.High,message);
}

function HandleEchoCommand(args,tags){
	SendMessage(MessagePriority.High, `@${tags.username}, you said: "${args.join(' ')}"`);
}

function HandleCloseRaffleCommand(args,tags){
	//check if raffle is already closed
	if(!isRaffleOpen){
		SendMessage(MessagePriority.High, `The raffle is already closed`);
		return;
	}
	isRaffleOpen = false;
	global_currentWinnerCount = 0;
	SendMessage(MessagePriority.High, `The raffle is now closed`);
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
		console.log(error);
		SendMessage(MessagePriority.High, `An error was encountered while attempting to determine the winners. Please run !setwinners with the number you still want to draw, then run !getwinners again.`);
	});
}

function ShouldContinueDrawingWinners(){
	console.log('figuring out if I should continue');
	//handle the case of our list being exhausted
	if(currentRaffleList.length == 0){
		SendMessage(MessagePriority.High, `There are no more potential winners to be chosen`);
		return false;
	}
	if(global_currentWinnerCount >= global_desiredWinnerCount){
		SendMessage(MessagePriority.High, `The max number of winners for this run has been reached!`);
		return false;
	}
	return true;
}

function SelectWinnerFromList(){
	console.log('selecting winner');
	//handle the case of our list being exhausted
	if(currentRaffleList.length == 0){
		SendMessage(MessagePriority.High, `There are no more potential winners to be chosen`);//TODO: i don't know if this is still necessary
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
		SendMessage(MessagePriority.High, `The raffle is already open`);
		return;
	}
	//clear out the current list of entrants such that they must re-enter for each raffle
	currentRaffleList = [];
	currentRaffleTwitchName = [];
	isRaffleOpen = true;
	SendMessage(MessagePriority.High, `The raffle is now open`);
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
		if(isRaffleOpen)messageBufferWrongName.push(tags.username);		
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
	//raffle must still be open to register the player
	if(!isRaffleOpen)return;

	var playerFaction = characterSummary['data']['faction']['type'];

	if(characterSummary['data']['level'] != 60){
		SendMessage(MessagePriority.Low, `@${tags.username}, The character you entered must be level 60!`);//TODO: maybe make this another buffer
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
		SendMessage(MessagePriority.High, `@${tags.username}, please provide only two arguments to the setwinners command. ex: \"!setwinners 15\"`);
		return;
	}
	global_desiredWinnerCount = parseInt(args[0]);
	SendMessage(MessagePriority.High, `${global_desiredWinnerCount} players will be able to win in the next raffle!`);
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
		global_BlizzardAuthToken =  response['data']['access_token']
		return response['data']['access_token']
	}
	else{
		if(debug)console.log("Failed to get an auth token from blizzard, maybe add a retry here at some point.")
		return;
	}
}

function FetchPlayerMounts(playerInfo){
	console.log('fetching player mounts');
	if(playerInfo == null){
		console.log('bailing out of fetching player mounts because no info provided.');
		throw new Error('bailing out of fetching player mounts because no info provided.');
	}
	//playerinfo comes in the form character_realm here right now
	playerInfo = playerInfo.toLowerCase().split("_");

	//playerInfo[1] contains the realm
	//playerInfo[0] contains the character name
	var getURL = 'https://us.api.blizzard.com/profile/wow/character/'+playerInfo[1]+'/'+playerInfo[0]+'/collections/mounts';
	return axios.get(getURL,{params:{namespace : 'profile-us',
		locale : 'en_US',
		access_token : global_BlizzardAuthToken},
		timeout : 3000});
}

function FindMountInCollection(playerMountCollection){
	console.log('parsing mounts');
	if(playerMountCollection == null){
		console.log('received an empty collection of mounts');
		throw new Error('received an empty collection of mounts');
	}
	for(var mount of playerMountCollection['data']['mounts']){
		if(mount['mount']['id']==process.env.AOTC_MOUNT_ID)return true;
	}
	return false;
}

function DeterminePlayerEligibility(selectedWinner,doesPlayerHaveMount){
	console.log('determining if player can win');
	if(selectedWinner == null){
		console.log('no valid player was sent in to determine eligibility');
		throw new Error('no valid player was sent in to determine eligibility');
	}
	if(doesPlayerHaveMount){
		SendMessage(MessagePriority.High, `@${global_playerToTwitchNameDictionary[selectedWinner]} already has the mount and is NOT eligible for a carry!`);
	}
	else{
		SendMessage(MessagePriority.High, `@${global_playerToTwitchNameDictionary[selectedWinner]} has won a carry with character {{${selectedWinner.replace('_','-')}}} on ${global_playerFactionDictionary[selectedWinner]} ! ${modList}`);
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

function CanSendMessage(priorityLevel){
	if (timeWindowForThrottle == undefined){
		timeWindowForThrottle = new Date();
	}
	var currentTime = new Date();
	var diff = ( currentTime.getTime() - timeWindowForThrottle.getTime() ) / 1000; //seconds between throttle window and current time
	if(diff > 30){
		timeWindowForThrottle = currentTime; //reset the window if it has been 30 seconds
		messagesInThrottleWindow = 0;
	}
	if((priorityLevel == MessagePriority.High) && (messagesInThrottleWindow < 95)){
		return true;
	}
	if((priorityLevel == MessagePriority.Low) && (messagesInThrottleWindow < 70)){
		return true;
	}
	return false;
}

function SendMessage(priorityLevel,message){
	if(!CanSendMessage(priorityLevel)){
		console.log('turned away message with priority level of '+priorityLevel+' with message '+message);
		return;
	}
	messagesInThrottleWindow++;
	global_client.say(globalChannel, message);
	console.log('messages in current time window: '+messagesInThrottleWindow);
}

function SendMessageBuffer(buffer,message){
	if(buffer.length == 0) return;
	if(!CanSendMessage(MessagePriority.Low)) return; //don't drain the buffer if we are already at message quota for low priorty

	var usersPerMessage = 25;
	var count = 0;
	var userListString = '';
	while((buffer.length > 0) && (count < usersPerMessage)){
		userListString += '@'+buffer.shift() + ' '; 
		count++;
	}
	if(userListString != ''){
		messagesInThrottleWindow++;
		global_client.say(globalChannel, userListString+message);
		console.log('messages in current time window: '+messagesInThrottleWindow);
	}
}