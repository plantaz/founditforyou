import axios from 'axios';
import * as faceapi from 'face-api.js';

let storedImages = [];
let referenceFaceDescriptor;

// Function to extract folder ID from Google Drive URL
function extractFolderId(url) {
    const regex = /folders\/([A-Za-z0-9_-]+)/;
    const match = url.match(regex);
    if (!match) {
        return null;
    }
    return match[1];
}

// Function to validate user input (Google Drive folder URL)
function validateInput(url, folderId) {
    if (!folderId) {
        showError('Invalid Google Drive folder URL');
        return false;
    }
    return true;
}

// Function to fetch all files from a Google Drive folder via Netlify Function
async function fetchAllDriveFiles(folderId, nextPageToken = null) {
    try {
        const response = await fetch('/.netlify/functions/fetchDriveFiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folderId, nextPageToken })
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }
        // Append the fetched files to the storedImages array
        storedImages = storedImages.concat(filterImageFiles(data.files));
        // Check if there's another page of results
        if (data.nextPageToken) {
            await fetchAllDriveFiles(folderId, data.nextPageToken);
        }
    } catch (error) {
        console.error('Error fetching drive files:', error);
        showError(`Error fetching drive files: ${error.message}`);
        throw error;
    }
}

// Function to filter out non-image files
function filterImageFiles(files) {
    return files.filter(file => file.mimeType.startsWith('image/'));
}

// Function to display the number of images found
function displayResults(images) {
    document.getElementById('count').innerText = images.length;
    document.getElementById('foundImagesCount').innerText = images.length;
}

// Function to toggle visibility of the pages
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// Function to clear search results
function clearResults() {
    document.getElementById('count').innerText = '0';
    document.getElementById('error').innerText = '';
    clearSearchResults();
}

// Function to show error messages
function showError(message) {
    document.getElementById('error').innerText = message;
}

// Function to clear search results area
function clearSearchResults() {
    document.getElementById('resultsArea').innerHTML = '';
    resetCounters();
}

// Function to initialize the app and load models
async function initApp() {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    await faceapi.nets.faceExpressionNet.loadFromUri('/models');
    console.log('Models loaded successfully.');
}

// Function to process the selected Google Drive folder
async function processFolder() {
    clearResults();
    const url = document.getElementById('gdriveUrl').value;
    const folderId = extractFolderId(url);
    if (!validateInput(url, folderId)) return;
    storedImages = []; // Reset storedImages before starting
    await fetchAllDriveFiles(folderId);
    displayResults(storedImages);
    if (storedImages.length > 0) {
        showPage('page2');
    } else {
        showError('No images found in the specified directory.');
    }
}

// Function to upload a face to the collection
async function uploadFace() {
    clearUploadResults();
    const fileInput = document.getElementById('faceImage');
    const file = fileInput.files[0];
    if (!validateImageFile(file)) return;

    try {
        const img = await loadImageFromFile(file);
        const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detections || !detections.descriptor) {
            throw new Error('No face detected in the uploaded image.');
        }

        referenceFaceDescriptor = detections.descriptor;
        const collectionId = `face-collection-${Date.now()}`;
        displayUploadResults(collectionId, 'Reference Face');
        showPage('page3');
        await searchForFaceInImages(referenceFaceDescriptor);
    } catch (error) {
        showError(`Error uploading face: ${error.message}`);
    }
}

// Function to validate the uploaded image file
function validateImageFile(file) {
    if (!file) {
        showError('Please select an image file.');
        return false;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showError('Only JPEG and PNG images are allowed.');
        return false;
    }
    return true;
}

// Function to read an image file as an Image object
async function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => resolve(img);
            img.onerror = reject;
        };
        reader.readAsDataURL(file);
    });
}

// Function to display the upload results
function displayUploadResults(collectionId, faceId) {
    document.getElementById('uploadResults').innerText = `Face uploaded to collection '${collectionId}' with ID '${faceId}'`;
}

// Function to clear upload results
function clearUploadResults() {
    document.getElementById('uploadResults').innerText = '';
}

// Function to search for the face in images listed from Google Drive
async function searchForFaceInImages(referenceDescriptor) {
    const searchResultsDiv = document.getElementById('resultsArea');
    searchResultsDiv.innerHTML = ''; // Clear previous results
    resetCounters();

    for (const image of storedImages) {
        try {
            const imageUrlLh3 = `https://lh3.googleusercontent.com/d/${image.id}=s1000`; // For face-api.js
            const imageUrlDrive = `https://drive.google.com/file/d/${image.id}/view`; // For hyperlink

            const img = await loadImageFromUrl(imageUrlLh3);
            const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

            if (!detections || !detections.descriptor) {
                const resultText = `${image.name} - No face matches found<br>`;
                appendResult(resultText);
                incrementCounter('notMatched');
                continue;
            }

            const targetDescriptor = detections.descriptor;
            const distance = faceapi.euclideanDistance(referenceDescriptor, targetDescriptor);

            if (distance < 0.6) { // Threshold value for similarity
                const resultText = `<a href="${imageUrlDrive}" target="_blank">${image.name}</a> - Face found<br>`;
                appendResult(resultText);
                incrementCounter('matched');
            } else {
                const resultText = `${image.name} - No face matches found<br>`;
                appendResult(resultText);
                incrementCounter('notMatched');
            }

            // Delay for 0.1 second before processing the next image
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`Error searching for face in image '${image.name}':`, error);
            const resultText = `${image.name} - Error searching for face: ${error.message}<br>`;
            appendResult(resultText);
            incrementCounter('notMatched');
        }
    }
}

// Function to fetch image bytes for face-api.js
async function loadImageFromUrl(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const img = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas;
}

// Function to append results to the results area
function appendResult(text) {
    const resultsArea = document.getElementById('resultsArea');
    resultsArea.innerHTML += text; // Using innerHTML to support hyperlinks
    resultsArea.scrollTop = resultsArea.scrollHeight; // Auto-scroll to bottom
}

// Function to increment counters for matched and not matched faces
function incrementCounter(type) {
    if (type === 'matched') {
        matchedCount++;
        document.getElementById('matchedCount').innerText = matchedCount;
    } else if (type === 'notMatched') {
        notMatchedCount++;
        document.getElementById('notMatchedCount').innerText = notMatchedCount;
    }
}

// Function to reset counters
function resetCounters() {
    matchedCount = 0;
    notMatchedCount = 0;
    document.getElementById('matchedCount').innerText = matchedCount;
    document.getElementById('notMatchedCount').innerText = notMatchedCount;
}

// Main functions exposed to the global scope
window.onload = async () => {
    await initApp();
    document.getElementById('analyzeFolderButton').addEventListener('click', processFolder);
    document.getElementById('uploadButton').addEventListener('click', uploadFace);
    document.getElementById('backButtonPage2').addEventListener('click', () => showPage('page1'));
    document.getElementById('backButtonPage3').addEventListener('click', () => showPage('page2'));
};

// Initial counters
let matchedCount = 0;
let notMatchedCount = 0;