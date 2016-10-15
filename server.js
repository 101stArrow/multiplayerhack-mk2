var express = require('express'),
    app = express(),
    mqtt = require('mqtt'),
    jsonfile = require('jsonfile'),
    low = require('lowdb');

const db = low('db.json')
var PORT = 80;
var client = mqtt.connect('mqtt://ericmuir.co.uk')
var file = 'questions.json'
var questions, currentquestion, active = 0,
    answers = {};
jsonfile.readFile(file, function(err, obj) {
    questions = obj
});
if (!db.has('players').value()) {
    db.set('players', []).value()
}

client.subscribe('answers/#');
client.subscribe('players');
client.on('connect', function() {
    currentquestion = questions[0]
});

client.on('message', function(topic, message) {
    console.log(topic + ': ' + message)
    if (topic == "players") {
        if (checkPlayer(message)) {
            console.log("Error: Player exists")
        } else {
            db.get('players').push({
                player: message.toString(),
                score: 0,
                joindate: Date.now(),
                lastactive: Date.now(),
                active: true
            }).value()
        }
    } else {
        parse = topic.split('/')
        user = parse[1]
        if (checkPlayer(user)) {
            answers[user] = {
                responce: message.toString(),
                time: Date.now()
            }
            db.get('players').find({
                    player: user
                }).assign({
                    lastactive: Date.now()
                }).value()
                console.log(answers)

        } else {
            console.log("Cannot find " + user)
        }
    }
    active = 0
    for (var key in answers) {
        user = db.get('players').find({
            player: key
        }).value()
        if (user.lastactive > Date.now() - 300 * 1000) {
            active++
        }
    }
    if (Object.keys(answers).length == active && active > 1) {
        console.log("All players answered")
        min = Date.now()
        player = ""
        for (var key in answers) {
            keydata = answers[key]
            if (keydata.time < min && parseAnswer(keydata.responce) == currentquestion.correct) {
                min = keydata.time
                player = key
            }
        }
        console.log(player + " wins this round")
        user = checkPlayer(player, "GET")
        user.score++
            db.get('players').find({
                player: player
            }).assign({
                score: user.score
            }).value()
        console.log("They now have " + user.score + " points")
        answers = {}
        currentquestion = questions[Math.ceil(Math.random() * questions.length)]
    }
});

function checkPlayer(player, mode) {
    if (db.get('players').find({
            player: player
        }).value()) {
        if (mode == "GET") {
            return db.get('players').find({
                player: player
            }).value()
        } else {
            return true
        }
    } else {
        return false
    }
}

function parseAnswer(letter){
  answer = letter.toUpperCase();
  switch(answer){
    case "A":
        return(0)
        break;
    case "B":
        return(1)
        break;
    case "C":
        return(2)
        break;
    case "D":
        return(3)
        break;
  }
}

app.get('/', function(req, res) {
    res.redirect('/display.html')
});

app.get('/question', function(req, res) {
    res.json({
        question: currentquestion.question,
        answers: currentquestion.answers
    })
});

app.use(express.static('public'));

app.listen(PORT)
