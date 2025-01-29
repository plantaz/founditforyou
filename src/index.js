// src/index.js
import AWS from 'aws-sdk';

let rekognition;

async function initAWS() {
    AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
    });
    rekognition = new AWS.Rekognition();
}

initAWS();

// Google Drive Functions
async function processFolder() {
    const API_KEY = process.env.API_KEY;
    // ... rest of your Google Drive functions ...
}

// AWS Face Collection Functions
async function uploadFace() {
    await initAWS(); // Initialize AWS Rekognition with environment variables
    // ... rest of your upload face functions ...
}