const express = require('express');  
const cors = require('cors');  
const { BlobServiceClient } = require('@azure/storage-blob');  
const bodyParser = require('body-parser');  
  
const app = express();  
const port = 3000;  
  
// Use CORS middleware  
app.use(cors({  
  origin: 'https://orange-field-0f73bd20f.4.azurestaticapps.net'  
}));  
app.use(bodyParser.json());  
  
require('dotenv').config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = 'prompts';  
  
app.post('/api/savePrompt', async (req, res) => {  
  const { categoryName, itemNames, itemDescriptions } = req.body;  
  try {  
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);  
    const containerClient = blobServiceClient.getContainerClient(containerName);  
    await containerClient.createIfNotExists();  
  
    const blobName = `${categoryName}-${new Date().toISOString()}.json`;  
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);  
  
    const promptData = {  
      categoryName,  
      itemNames,  
      itemDescriptions  
    };  
  
    const uploadBlobResponse = await blockBlobClient.upload(JSON.stringify(promptData), Buffer.byteLength(JSON.stringify(promptData)));  
    console.log(`Upload block blob ${blobName} successfully`, uploadBlobResponse.requestId);  
  
    res.status(200).send('Prompt saved successfully');  
  } catch (error) {  
    console.error('Error saving prompt:', error);  
    res.status(500).send('Error saving prompt');  
  }  
});  
  
app.get('/api/getPrompts', async (req, res) => {  
  try {  
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);  
    const containerClient = blobServiceClient.getContainerClient(containerName);  
  
    let prompts = [];  
    for await (const blob of containerClient.listBlobsFlat()) {  
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);  
      const downloadBlockBlobResponse = await blockBlobClient.download(0);  
      const downloaded = await streamToString(downloadBlockBlobResponse.readableStreamBody);  
      const promptData = JSON.parse(downloaded);  
      prompts.push(promptData);  
    }  
  
    res.status(200).json(prompts);  
  } catch (error) {  
    console.error('Error retrieving prompts:', error);  
    res.status(500).send('Error retrieving prompts');  
  }  
});  
  
async function streamToString(readableStream) {  
  return new Promise((resolve, reject) => {  
    const chunks = [];  
    readableStream.on('data', (data) => {  
      chunks.push(data.toString());  
    });  
    readableStream.on('end', () => {  
      resolve(chunks.join(''));  
    });  
    readableStream.on('error', reject);  
  });  
}  
  
app.listen(port, () => {  
  console.log(`Server listening at http://localhost:${port}`);  
});  
