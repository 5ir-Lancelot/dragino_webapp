
// this is the backend file
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const EventHubReader = require('./scripts/event-hub-reader.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const iotHubConnectionString = process.env.IotHubConnectionString;
const eventHubConsumerGroup = process.env.EventHubConsumerGroup;

//check the websocket connection
wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  ws.on('message', (message) => {
    console.log('Message received from client:', message);
  });
});


if (!iotHubConnectionString || !eventHubConsumerGroup) {
  console.error('Environment variables IotHubConnectionString and EventHubConsumerGroup must be specified.');
  process.exit(1);
}

app.use(express.static(path.join(__dirname, 'public')));

// Path for storing data
const DATA_FOLDER = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_FOLDER, 'telemetry-data.csv');
const DATA_FILE_JS = path.join(DATA_FOLDER, 'telemetry-data.json');

// Ensure the data folder exists
if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER);
}

// CSV writer setup
const csvWriter = createObjectCsvWriter({
  path: DATA_FILE,
  header: [
    { id: 'date', title: 'date' },
    { id: 'deviceId', title: 'deviceId' },
    { id: 'soilTemperature', title: 'soilTemperature' },
    { id: 'soilConductivity', title: 'soilConductivity' },
    { id: 'soilWaterContent', title: 'soilWaterContent' },
    { id: 'battery', title: 'battery' },
    { id: 'pH', title: 'pH' },
  ],
});

// Write headers if the file does not exist
if (!fs.existsSync(DATA_FILE)) {
  csvWriter.writeRecords([]); // Creating an empty file with headers
}



// Append data to the json file
function appendDataToFile(data) {
  const entry = JSON.stringify(data) + '\n';
  fs.appendFile(DATA_FILE_JS, entry, (err) => {
    if (err) console.error('Error writing data to file:', err);
  });
}

// Broadcast incoming data to WebSocket clients
wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

server.listen(process.env.PORT || 3000, () => {
  console.log('Listening on %d.', server.address().port);
});

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);

(async () => {
  await eventHubReader.startReadMessage((message, date) => {


    // Extract the device_id
    const deviceId = message.end_device_ids.device_id;

    // Print the entire message to see the raw data
    //console.log('Received message:', message);

    // Extract fields from decodedPayload Lukas Now correctly written
    const decodedPayload = message.uplink_message.decoded_payload || {};

    // Print the entire message to see the raw data
    //console.log('Received payload part:', decodedPayload);

    // extract the variables from the payload
    // when value undefinend put 'null'

    // for the EC meters
    const batteryVoltage_EC = decodedPayload.BatV !== undefined && decodedPayload.BatV !== null ? decodedPayload.BatV : null;
    const soilConductivity = decodedPayload.conduct_SOIL !== undefined && decodedPayload.conduct_SOIL !== null ? decodedPayload.conduct_SOIL : null;
    const soilTemperature = decodedPayload.temp_SOIL !== undefined && decodedPayload.temp_SOIL !== null ? decodedPayload.temp_SOIL : null;
    const soilWaterContent = decodedPayload.water_SOIL !== undefined && decodedPayload.water_SOIL !== null ? decodedPayload.water_SOIL : null;

    //for the pH meters
    const batteryVoltage_pH = decodedPayload.Bat !== undefined && decodedPayload.Bat !== null ? decodedPayload.Bat : null;
    const soilPH1 = decodedPayload.PH1_SOIL !== undefined && decodedPayload.PH1_SOIL !== null ? decodedPayload.PH1_SOIL : null;
    const soilTemperature_pH = decodedPayload.TEMP_SOIL !== undefined && decodedPayload.TEMP_SOIL !== null ? decodedPayload.TEMP_SOIL : null;
    //const ds18b20Temperature = decodedPayload.TempC_DS18B20 !== undefined && decodedPayload.TempC_DS18B20 !== null ? decodedPayload.TempC_DS18B20 : null;


    // Ensure all relevant data is present in the payload
    const payload = {
      date: date || new Date().toISOString(),
      deviceId: deviceId,
      soilTemperature: soilTemperature,
      soilConductivity: soilConductivity,
      soilWaterContent: soilWaterContent,
      pH: soilPH1,
    };

    // Write to CSV
    csvWriter.writeRecords([payload]) // Writing a single record
      .then(() => console.log('Data written to CSV:', payload));

    // Log the full data to the terminal for debugging
    //console.log('Broadcasted Data:', JSON.stringify(payload));

    // Write to file and broadcast
    //Share the data with the frontend
    appendDataToFile(payload);
    //check before sharing with frontend
    console.log('Broadcasting data to clients:', payload);
    wss.broadcast(JSON.stringify(payload));
  });
})().catch((err) => console.error(err));

// Endpoint to download the file
app.get('/download', (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    res.download(DATA_FILE, 'telemetry-data.csv', (err) => {
      if (err) console.error('Error sending file:', err);
    });
  } else {
    res.status(404).send('No data file available.');
  }
});
