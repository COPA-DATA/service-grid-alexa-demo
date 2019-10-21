/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const https = require('https');

// CHANGE ME !!!
const dataSourceId = '<project id of the zenon project>';
// CHANGE ME !!!
const serviceGridApiUrl = '<domain name of the Service Grid VM>';

// ENVIRONMENT VARIABLES
// Using Alexa hosted skills, do not support the usage of environment variables
// To use environment variables, switch to AWS lambda functions and use process.env.{item}
// https://docs.aws.amazon.com/de_de/lambda/latest/dg/tutorial-env_cli.html
// https://developer.amazon.com/de/docs/custom-skills/host-a-custom-skill-as-an-aws-lambda-function.html


// include mapping rules to map the names recognized by Alexa to existing zenon Variables
function mapVariableNameToZenonVariable(alexaVariableName) 
{
    return "Alexa_" + alexaVariableName.toLowerCase().replace(" ","");   
}


function translateHttpCode(httpCode)
{
    var message = "";
    switch (httpCode)
    {
        case 400:
            message = `It seems that there was an error with the HTTP request.`;
            break;
        case 401:
            message = `It seems that you are not authenticated to perform this action.`;
            break;
        case 402:
            message = `It seems that the backend API is not licensed.`;
            break;
        case 403:
            message = `It seems that you do not have the necessary permissions to perform this action.`;
            break;
        case 404:
            message = `It seems that I could not find the variable you are looking for.`;
            break;
        case 500:
            message = `It seems that some internal problem occurred.`;
            break;
        case 503:
            message = `It seems that the respective backend service is offline.`;
            break;
    }
    
    return message;
    
}


async function setValuePost(name, value, token)
{
  return new Promise(((resolve, reject) => {
    
    var data = JSON.stringify({
      "value": value
    });
    
    var options = {
      host: serviceGridApiUrl,
      port: 9400,
      path: `/api/v1/datasources/${dataSourceId}/variables/${name}`,
      method: 'PATCH',
      headers : {
        'Authorization': "Bearer " + token,
        'Content-Type':'application/json',
        'Content-Length': data.length
      }
    };
    
    var req = https.request(options, res => {
      res.setEncoding('utf8');
      var responseString = "";
      
      console.log('statusCode:',res.statusCode);
      
      
      res.on('data', chunk => {
        responseString = responseString + chunk;
      });
      
      res.on('end', () => {
          
        if (res.statusCode !== 200)
        {
            if (responseString.includes('"errorCode":"NotFound"'))
            {
                res.statusCode = 404;
            }
            
            console.error("Error during HTTP request: ");
            console.error("options: " + JSON.stringify(options));
            console.error("response: " + responseString);
            console.error("http code: " + res.statusCode);
            reject({message: translateHttpCode(res.statusCode) });
        }
        
        resolve(responseString);
      });
      
      res.on('error', (error) => {
        console.log("Error during request");
        reject(error);
      });
    });
  
    req.write(data);
    req.end();
  
  }));
}


async function getValueGet(name, token)
{
  return new Promise(((resolve, reject) => {
    
    var options = {
      host: serviceGridApiUrl,
      port: 9400,
      path: `/api/v1/datasources/${dataSourceId}/variables/${name}`,
      method: 'GET',
      headers : {
        'Authorization': "Bearer " + token,
        'Content-Type':'application/json'
      }
    };
    
    var req = https.request(options, res => {
      res.setEncoding('utf8');
      var responseString = "";
      
      console.log('statusCode:',res.statusCode);
      
      
      res.on('data', chunk => {
        responseString = responseString + chunk;
      });
      
      res.on('end', () => {
        
        if (res.statusCode !== 200)
        {
            if (responseString.includes('"errorCode":"NotFound"'))
            {
                res.statusCode = 404;
            }
            
            console.error("Error during HTTP request: ");
            console.error("options: " + JSON.stringify(options));
            console.error("response: " + responseString);
            console.error("http code: " + res.statusCode);
            reject({message: translateHttpCode(res.statusCode) });
        }
        
        var valueData = JSON.parse(responseString);
        resolve(valueData.value);
      });
      
      res.on('error', (error) => {
        console.log("Error during request");
        reject(error);
      });
    });
  
    req.end();
  
  }));
}


const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
    const speechOutput = "Hello and welcome to Motor Control. How can I help you?";
      return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
};


const SetValueHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'SetValueIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const variableName = slots.variableName.value;
    const variableValue = slots.variableValue.value;
    
    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      const zenonVariableName = mapVariableNameToZenonVariable(variableName);
      const response = await setValuePost(zenonVariableName, variableValue, accessToken);
      
      speechOutput = `I have successfully set the value of variable ${variableName} to ${variableValue}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};


const GetValueHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'GetValueIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const variableName = slots.variableName.value;
    
    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      const zenonVariableName = mapVariableNameToZenonVariable(variableName);
      const response = await getValueGet(zenonVariableName, accessToken);
      
      speechOutput = `The current value of variable ${variableName} is ${response}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
};


const IncreaseValueHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'IncreaseValueIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const variableName = slots.variableName.value;
    const offset = slots.offset.value;
    
    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      
      const zenonVariableName = mapVariableNameToZenonVariable(variableName);
      var response = await getValueGet(zenonVariableName, accessToken);
      
      const newValue = Number(response) + Number(offset);
      response = await setValuePost(zenonVariableName, newValue, accessToken);
      
      speechOutput = `I have successfully increased the value of variable ${variableName} by ${offset}. The current value is ${newValue}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
};


const DecreaseValueHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'DecreaseValueIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const variableName = slots.variableName.value;
    const offset = slots.offset.value;
    
    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      
      const zenonVariableName = mapVariableNameToZenonVariable(variableName);
      var response = await getValueGet(zenonVariableName, accessToken);
      
      const newValue = Number(response) - Number(offset);
      response = await setValuePost(zenonVariableName, newValue, accessToken);
      
      speechOutput = `I have successfully decreased the value of variable ${variableName} by ${offset}. The current value is ${newValue}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
  
};


const ResetValueHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'ResetValueIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const variableName = slots.variableName.value;

    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      
      const zenonVariableName = mapVariableNameToZenonVariable(variableName);
      const resetValue = 0;
      var response = await setValuePost(zenonVariableName, resetValue, accessToken);

      speechOutput = `I have successfully reset the value of variable ${variableName} to ${resetValue}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
  
};


const StartMotorHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'StartMotorIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const speed = slots.speed.value;

    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      var speedValue = 0;
      switch (speed)
      {
          case "fast":
              speedValue = 90;
              break;
          case "moderately":
              speedValue = 60;
              break;
          case "slowly":
              speedValue = 30;
              break;
      }
      
      const zenonVariableName = mapVariableNameToZenonVariable("motorspeed");
      var response = await setValuePost(zenonVariableName, speedValue, accessToken);

      speechOutput = `I have successfully started the motor ${speed}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
  
};


const SendMessageHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'SendMessageIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;
    const message = slots.message.value;

    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      
      const zenonVariableName = mapVariableNameToZenonVariable("message");
      var response = await setValuePost(zenonVariableName, message, accessToken);

      speechOutput = `I have successfully sent message ${message}`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
  
};


const StopMotorHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'StopMotorIntent');
  },
  async handle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    const context = handlerInput.requestEnvelope.context;
    
    const slots = handlerInput.requestEnvelope.request.intent.slots;

    var speechOutput;
    
    const accessToken = context.System.user.accessToken;
    if (accessToken === undefined)
    {
      speechOutput = LINK_ACCOUNT_MESSAGE;
    }
    else {
      
      const zenonVariableName = mapVariableNameToZenonVariable("motorspeed");
      var response = await setValuePost(zenonVariableName, 0, accessToken);

      speechOutput = `I have successfully stopped the motor`;
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
  
};


const AllActionsHandler = {
  
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest'
        && request.intent.name === 'AllActionsIntent');
  },
  async handle(handlerInput) {
    
    return handlerInput.responseBuilder
      .speak(HELP_ALL_ACTIONS)
      .reprompt(HELP_REPROMPT) // reprompt is required to keep Alexa listening after performing an action
      .getResponse();
  },
  
};


const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};


const CancelHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_REPROMPT)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};


const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)
      .getResponse();
  },
};


const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};


const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak(`Sorry, I encountered a problem. ${error.message}`)
      .reprompt(`Sorry, I encountered a problem. ${error.message}`)
      .getResponse();
  },
};


const SKILL_NAME = 'Service Grid';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye! We appreciate your business.';
const LINK_ACCOUNT_MESSAGE = 'Sorry, you have to link your account with Service Grid Identity Service to use this functionality.';

const HELP_ACTION_SET_VALUE = 'Set the value of a variable by saying "Set variable name to value 20."';
const HELP_ACTION_RESET_VALUE = 'Reset the value of a variable by saying "Reset variable name.';
const HELP_ACTION_GET_VALUE = 'Request the current value of a variable by saying "What\'s the value of variable name."';
const HELP_ACTION_INCREASE_VALUE = 'Increase the value of a variable by saying "Increase the value of variable name by 10."';
const HELP_ACTION_DECREASE_VALUE = 'Decrease the value of a variable by saying "Decrease the value of variable name by 10."';
const HELP_ACTION_START_MOTOR = 'Start the motor at a spcific speed by saying "Start motor slowly, moderately or fast"';
const HELP_ACTION_STOP_MOTOR = 'Stop the motor by saying "Stop motor"';
const HELP_ACTION_SEND_MESSAGE = 'Send a message by saying "Send message hello world"';

const HELP_ALL_ACTIONS = 'Here is a list of all available actions: ' + HELP_ACTION_SET_VALUE + ' ' + HELP_ACTION_RESET_VALUE + ' ' + HELP_ACTION_GET_VALUE + ' ' + HELP_ACTION_INCREASE_VALUE + ' ' + HELP_ACTION_DECREASE_VALUE + ' ' + HELP_ACTION_START_MOTOR + ' ' + HELP_ACTION_STOP_MOTOR;
const HELP_MESSAGE = 'Actually you can do several things. You can for example ' + HELP_ACTION_SET_VALUE + ' For a list with all available actions, say "Please tell me all available actions."';


exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    SetValueHandler,
    GetValueHandler,
    IncreaseValueHandler,
    DecreaseValueHandler,
    ResetValueHandler,
    StartMotorHandler,
    StopMotorHandler,
    SendMessageHandler,
    AllActionsHandler,
    HelpHandler,
    ExitHandler,
    CancelHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
