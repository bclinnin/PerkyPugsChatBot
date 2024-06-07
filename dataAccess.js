const {Client} = require('pg')

var client;
var previousWinnersByTwitchName = {};
var previousWinnersByRealmCharacterCombo = {};

function dbStartup(){
  console.log('Caching database');
  console.log(process.env.DATABASE_URL);

  client = GetDatabaseClient();
  client.connect()
  .then(()=>client.query("select * from fyrakkwinners"))
  .then((result)=>PopulateGlobalLookups(result))
  console.log('Database caching complete');
}

function GetDatabaseClient(){
  if(process.env.CURRENT_ENVIRONMENT == 'local'){
    return new Client({
      connectionString: process.env.DATABASE_URL
    });
  }
  else{
    return new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }
}
function PopulateGlobalLookups(result){
  console.log(result.rows)
  for(var idx in result.rows){
    var currentTwitchName = result.rows[idx].twitchname;
    var currentRealmCharacterCombo = result.rows[idx].realmcharactercombo;
    AddNameToTwitchWinnersList(currentTwitchName)
    AddNameToCharacterWinnersList(currentRealmCharacterCombo)
  }
}

function AddNameToTwitchWinnersList(name){
  if(name in previousWinnersByTwitchName){
    previousWinnersByTwitchName[name] += 1;
  }
  else{
    previousWinnersByTwitchName[name] = 1;
  }
}
function AddNameToCharacterWinnersList(character){
  if(character in previousWinnersByRealmCharacterCombo){
    previousWinnersByRealmCharacterCombo[character] += 1;
  }
  else{
    previousWinnersByRealmCharacterCombo[character] = 1;
  }
}

function PersistNewWinner(twitchName_,realm_,charactername_,combo_){
  try{
    var myquery = `INSERT INTO fyrakkWinners (twitchName,realm,characterName,realmCharacterCombo) VALUES ($1,$2,$3,$4)`;
    var values = [twitchName_,realm_,charactername_,combo_];
    console.log(myquery);
    client.query(myquery, values);
  }
  catch(error){
    console.log(`Failed to persist winner ${combo_}`);
  }
}

module.exports = {
    dbStartup,
    PersistNewWinner,
    AddNameToTwitchWinnersList,
    AddNameToCharacterWinnersList,
    previousWinnersByTwitchName,
    previousWinnersByRealmCharacterCombo

};

