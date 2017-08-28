/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*eslint-disable unknown-require */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var request = require('request');
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var watson  = require('watson-developer-cloud');

var app = express();
var temp = '';

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-10-21',
  version: 'v1'
});


var retrieve_and_rank = watson.retrieve_and_rank({
  username: 'c6ce8010-2d51-4240-8ea1-ca7fef98124a',
  password: 'Vts6xmWJ7FUw',
  version: 'v1'
});

var params = {
  cluster_id: 'sc095bfcdb_c4b4_4fc6_b182_7493ceac558e',
  collection_name: 'soho'
};

//  Use a querystring parser to encode output.
var qs = require('qs');

// Get a Solr client for indexing and searching documents.
// See https://github.com/watson-developer-cloud/node-sdk/blob/master/services/retrieve_and_rank/v1.js
var solrClient = retrieve_and_rank.createSolrClient(params);

var ranker_id = '7ff701x33-rank-1608';
var question  = 'how do i set up quantum view?';
var query     = qs.stringify({q: question, ranker_id: ranker_id, fl: 'contentHtml'});

solrClient.get('fcselect', query, function(err, searchResponse) {
  if(err) {
    console.log('Error searching for documents: ' + err);
  }
    else {
     // console.log(searchResponse);
     // console.log(JSON.stringify(searchResponse.response.docs[0].contentHtml, null, 1));
      temp = JSON.stringify(searchResponse.response.docs[0].contentHtml, null, 1);
      rip();
    }
});

function rip(){
 
var headers_conv = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': 'Basic YWFjZWU2MTgtOTEwMS00N2NhLWEzZGQtMzBhOGJmMWMxZGMyOnQ3SW1XSkxrODJ4bQ=='
};



var dataString = '{ "output": { "text": {  "values": [' + temp + '], "selection_policy": "sequential" }  }  }';

var options_conv = {
    url: 'https://watson-api-explorer.mybluemix.net/conversation/api/v1/workspaces/7dfbc190-50cd-4db6-ae19-6c379a9e7f55/dialog_nodes/multiply?version=2017-05-26',
    method: 'POST',
    headers: headers_conv,
    body: dataString
};

function callback_conv(error, response, body) {
    if (!error && response.statusCode === 200) {
        console.log(body);
    }
}

request(options_conv, callback_conv);
}


// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
      return res.status(err.code || 500).json(err);
    }
    return res.json(updateMessage(payload, data));
  });
});

/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
  	// Check if the intent returned from Conversation service is add or multiply, perform the calculation and update the response
  	if (response.intents.length > 0 && (response.intents[0].intent === 'add' || response.intents[0].intent === 'multiply')) {
			response = getCalculationResult(response);
	}
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

/**
 * Get the operands, perform the calculation and update the response text based on the calculation.
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function getCalculationResult(response){
	//An array holding the operands
	var numbersArr = [];
	
	//Fill the content of the array with the entities of type 'sys-number' 
	for (var i = 0; i < response.entities.length; i++) {
		if (response.entities[i].entity === 'sys-number') {
			numbersArr.push(response.entities[i].value);
		}
	}
	
	// In case the user intent is add, perform the addition
	// In case the intent is multiply, perform the multiplication
	var result = 0;
	if (response.intents[0].intent === 'add') {
		result = parseInt(numbersArr[0]) + parseInt(numbersArr[1]);
	} else if (response.intents[0].intent === 'multiply') {
		result = parseInt(numbersArr[0]) * parseInt(numbersArr[1]);
	}

	// Replace _result_ in Conversation Service response, with the ac-tual calculated result



	var output = response.output.text[0] + temp;
	//output = output.replace('_result_', result);

	response.output.text[0] = output;
	
	// Return the updated response text based on the calculation
	return response;
}

module.exports = app;
