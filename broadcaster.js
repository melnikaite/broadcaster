#!/usr/bin/env node
var WebSocketServer = require('websocket').server;
var http = require('http');
var clients = {};
var fs = require('fs');
var path = require('path');
var util = require('util');
var uuid = require('node-uuid');
var convertString = require('convert-string');
var convertHex = require('convert-hex');

var server = http.createServer(function(request, response){
	console.log((new Date()) + ' Received request for ' + request.url);
	response.writeHead(404);
	response.end();
});
server.listen(8080, function(){
	console.log((new Date()) + ' Server is listening on port 8080')
});

wsServer = new WebSocketServer({
	httpServer: server,
	autoAcceptConnections: false
});

wsServer.on('request', function(request){
	// Accept connection
	var connection = request.accept('echo-protocol', request.origin);
	// Specific id for this client
	var id = uuid.v4();
	// Store the connection method so we can loop through & contact all clients
	clients[id] = connection;
	console.log((new Date()) + ' Connection accepted [' + id + ']');

	readExistingFiles(function(signal){
		sendToAll(JSON.stringify([signal]))
	});

	connection.on('message', function(message){
		var count = parseInt(message.utf8Data, 10);
		console.log((new Date()) + ' Requested new ' + count + ' signals.');
		generateFakeSignals(count);
	});

	connection.on('close', function(reasonCode, description){
		delete clients[id];
		console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
	})
});

// Send a message to the client with the message
var sendToAll = function(data){
	for(var i in clients){
		clients[i].send(data);
	}
};

var encodeData = function(data){
	try{
		return convertHex.bytesToHex(
			convertString.stringToBytes(
				JSON.stringify(data)
			)
		)
	}catch(err){
		console.log('Failed to encode data: ' + data + ' because of ' + err)
	}
};

var decodeData = function(data){
	try{
		return JSON.parse(
			convertString.bytesToString(
				convertHex.hexToBytes(data)
			)
		)
	}catch(err){
		console.log('Failed to decode data: ' + data + ' because of ' + err)
	}
};

var readExistingFile = function(filename, callback){
	fs.readFile(path.join('signals', filename), function(err, data){
		if(err){
			console.log(err)
		}else{
			var signal = decodeData(data.toString());
			if(signal){
				callback(signal, filename)
			}
		}
	})
};

var readExistingFiles = function(callback){
	fs.readdir('signals', function(err, files){
		if(err){
			console.log(err)
		}else{
			for(var i in files){
				if(files[i] == '.DS_Store') continue;
				readExistingFile(files[i], callback)
			}
		}
	})
};

// Clean old files created more than 7 days ago every 0 sec
setInterval(function(){
	readExistingFiles(function(signal, filename){
		var lastValiddate = new Date();
		lastValiddate.setDate(lastValiddate.getDate() - 7);
		if(signal.timestamp < lastValiddate){
			fs.unlink(path.join('signals', filename), function(err){
				if(err) console.log(err)
			})
		}
	})
}, 60 * 1000);

// Watch new files
fs.watch('signals', function(event, filename){
	fs.readFile(path.join('signals', filename), function(err, data){
		if(err){
			// File may not exists
			console.log(err)
		}else{
			var signal = decodeData(data.toString());
			if(signal){
				sendToAll(JSON.stringify([signal]))
			}
		}
	})
});

// Generate fake signals on startup
var generateFakeSignals = function(count){
	for(var i = 0; i < count; i++){
		var time = new Date();
		time.setSeconds(time.getSeconds() - count + i);
		var signal = {
			timestamp: time.getTime(),
			sensor1: Math.random(),
			sensor2: Math.random()
		};
		var data = encodeData(signal);
		if(data){
			fs.writeFile(path.join('signals', uuid.v4() + '.txt'), encodeData(signal), function(err){
				if(err){
					console.log(err)
				}else{
					console.log((new Date()) + ' Generated new signal: ' + util.inspect(signal));
				}
			});
		}
	}
};
