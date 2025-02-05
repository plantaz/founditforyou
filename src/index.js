import AWS from 'aws-sdk';

let storedImages = [];
let rekognition;

// Initialize AWS Rekognition with environment variables
async function initAWS() {
    AWS.config.update({
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
        region: process.env.MY_AWS_REGION // Ensure this line uses the correct env var
    });
    rekognition = new AWS.Rekognition();
}

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

// Function to initialize the app and load AWS credentials
async function initApp() {
    try {
        await initAWS(); // Initialize AWS Rekognition with environment variables
        console.log('AWS initialized successfully.');
    } catch (error) {
        console.error('Error initializing AWS:', error);
        showError('Failed to initialize AWS.');
        throw error;
    }
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
        await initAWS(); // Initialize AWS Rekognition with environment variables
        if (file.size > 5 * 1024 * 1024) {
            showError('File size exceeds 5MB limit');
            return;
        }
        const imageBytes = await readFileAsBytes(file);
        const collectionId = `face-collection-${Date.now()}`;
        
        await rekognition.createCollection({ CollectionId: collectionId }).promise();
        
        const params = {
            CollectionId: collectionId,
            Image: { Bytes: imageBytes },
            MaxFaces: 1,
            QualityFilter: 'AUTO'
        };
        
        const response = await rekognition.indexFaces(params).promise();
        const faceId = response.FaceRecords[0].Face.FaceId;
        displayUploadResults(collectionId, faceId);
        showPage('page3');
        // Search for the face in the images listed from Google Drive
        await searchForFaceInImages(collectionId, faceId);
    } catch (error) {
        showError(`AWS Error: ${error.message}`);
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

// Function to read an image file as bytes
function readFileAsBytes(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(new Uint8Array(e.target.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
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
async function searchForFaceInImages(collectionId, faceId) {
    const searchResultsDiv = document.getElementById('resultsArea');
    searchResultsDiv.innerHTML = ''; // Clear previous results
    resetCounters();

    for (const image of storedImages) {
        try {
            const imageUrlLh3 = `https://lh3.googleusercontent.com/d/${image.id}=s1000`; // For AWS Rekognition
            const imageUrlDrive = `https://drive.google.com/file/d/${image.id}/view`; // For hyperlink
            const imageBytes = await fetchImageBytes(imageUrlLh3);

            const searchParams = {
                CollectionId: collectionId,
                Image: { Bytes: imageBytes },
                MaxFaces: 1,
                FaceMatchThreshold: 70,
                QualityFilter: 'AUTO'
            };

            const searchResponse = await rekognition.searchFacesByImage(searchParams).promise();
            
            if (searchResponse.FaceMatches && searchResponse.FaceMatches.length > 0) {
                const matchedFace = searchResponse.FaceMatches[0].Face;
                const resultText = `<a href="${imageUrlDrive}" target="_blank">${image.name}</a> - Face found with ID '${matchedFace.FaceId}'<br>`;
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

// Function to fetch image bytes for AWS Rekognition
async function fetchImageBytes(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
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