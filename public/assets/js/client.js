// PUBLIC/PLAYLIST
var next_match;
var current_match;
var animation_timeout = Date.now();
var cropped = false;
document.onkeydown = checkKey;
function checkKey(e) {
  var current_time = Date.now();
  if(current_time > animation_timeout+1500){
    if(e.repeat)
      return;
    animation_timeout = current_time;
    e = e || window.event;
    if (e.keyCode == '37') {
      var left = $(".playercard")[0];
       castVote(left);
    }
    if (e.keyCode == '38') {
       skip();
    }
    else if (e.keyCode == '39') {
      var right = $(".playercard")[1];
      castVote(right);
    }
  }
}
function firstRun(){
  // Add "Bounce In Up animation to playercards"
  $(".playercard").addClass("bounceInUp");
  
  getFirstMatch();
}

function getNextMatch() {
  let voterFbId = Cookies.get("fbId");

  if(voterFbId == undefined) {
  	voterFbId = -1;
  }
  $.ajax({
    type: "GET",
    crossdomain:true,
    headers: {"Access-Control-Allow-Origin": "*"},
    url: "../../../api/match/"+country+"/"+gender+"?voterFbId="+voterFbId
  }).done(function (data) {
    if("error" in data){
      alert("Failed to preload next match");
    }else{
      data = [data.profile0,data.profile1,data.matchUUID];
      preload_image_0 = new Image();
      preload_image_0.src = data[0].picture;
      console.log("preloaded image 0 "+data[0].picture);

      preload_image_1 = new Image();
      preload_image_1.src = data[1].picture;
      console.log("preloaded image 1 "+data[1].picture);
      next_match = data;
    }
  });
}

function getFirstMatch() {
  let voterFbId = Cookies.get("fbId");

  if(voterFbId == undefined) {
  	voterFbId = -1;
  }
  $.ajax({
    type: "GET",
    crossdomain:true,
    headers: {"Access-Control-Allow-Origin": "*"},
    url: "../../../api/match/"+country+"/"+gender+"?voterFbId="+voterFbId
  }).done(function (data) {
    if("error" in data){
      alert(data.error);
    }else{
      data = [data.profile0,data.profile1,data.matchUUID];
      fillData(data);
    }
  });
}
// The following function determines which animationEvent the browser uses
// This is to prevent animationEnd being fired twice and ruining the flow of async loading
function whichAnimationEvent(){
  const el = document.createElement("fakeelement");
  
  // Keep it staticly within this function (ie. singleton)
  this.animations = this.animations || {
    "animation"      : "animationend",
    "OAnimation"     : "oAnimationEnd",
    "MozAnimation"   : "animationend",
    "WebkitAnimation": "webkitAnimationEnd"
  };
  
  for (var t in this.animations){
    if (el.style[t] !== undefined){
      return this.animations[t];
    }
  }
}

function cropImage(cardIndex) {
  var card_element = jQuery.find('.playercard')[cardIndex];
  if(!cropped) {
    $(card_element).find(".card_picture").css("background-size","contain");
    cropped = true;
  }else{
    $(card_element).find(".card_picture").css("background-size","cover");
    cropped = false;
  }

}
function castVote(card) {

  var animationEvent = whichAnimationEvent();
  // When you vote on a card.
  var winner = $(card).attr("name");
  $.post( "../../../api/vote", {playlistCategory: country,gender: gender, matchUUID: current_match[2], result: winner})
    .done(function( data ) {
      console.log(data);
    });
  $(".playercard").removeClass("bounceInUp");
  $(card).addClass("bounceOutUp"); // Make winnercard fly up
  $(".playercard").addClass("bounceOutDown"); // Looser card flies down
  $(card).one(animationEvent, function(){ // when animation is done
    $(".playercard").removeClass().addClass("playercard animated");
    nextRun(); // load next match
  });
}
function nextRun() {
  $(".playercard").removeClass().addClass("playercard animated");
  $(".playercard").addClass("bounceInUp");
  fillData(next_match);
}
function toggleLicense() {
  $("#license_modal").modal();
}
function fillData(data) {
    current_match = data;
    var license_string = "";
    // loop to go through the two players and fill the two cards
    for(var i=0;i < data.length-1;i++) { // data.length-1 to exclude UUID from the data array
      profile = data[i];
      var card = $(".playercard")[i];
      //insert picture
      $(card).find(".card_picture").css("background-image","url("+profile.picture+")");
      $(card).find(".card_name").html(profile.name);
      $(card).find("#elo").html(profile.elo);
      $(card).find("#rank").html(profile.rank);
      if(country == "hw" || country == "hos") {
        $(card).find("#known_for").html("<b>Known for</b><br />"+profile.known_for);
      }
      var total_matches = profile.wins+profile.losses;
      if(total_matches == 0)
        total_matches = 1;
      $(card).find("#winrate").html(Math.round(profile.wins / total_matches * 100) + "%");

      var license_entry = "<br />Picture of "+profile.name+"<br />Author: <b>"+profile.picture_author+"</b><br />License: "+profile.picture_license+"<br /><hr>";
      license_string += license_entry;
    }
    getNextMatch();
    $("#license_modal #license_fill").html(license_string);
}
function skip() {
  var animationEvent = whichAnimationEvent();
  var winner = -1;
  $.post( "../../../api/vote", {playlistCategory: country,gender: gender, matchUUID: current_match[2], result: winner})
    .done(function( data ) {
    });
  $(".playercard").removeClass().addClass("playercard animated");
  var left = $(".playercard")[0];
  var right = $(".playercard")[1];
  $(left).addClass("bounceOutLeft");
  $(right).addClass("bounceOutRight");
  $(left).one(animationEvent, function(){
    // When animations are done -> Remove all classes -> Add the basic classes without animations
    $(".playercard").removeClass().addClass("playercard animated");
    // Show next match, which should be preloaded
    nextRun();
  });
}
