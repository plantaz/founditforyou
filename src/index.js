let storedImages = [];
let matchedCount = 0;
let notMatchedCount = 0;

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

// Function to fetch all files from a Google Drive folder via Render Backend
async function fetchAllDriveFiles(folderId, nextPageToken = null) {
    try {
        const response = await fetch('https://your-backend.onrender.com/fetch_drive_files', {
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

// Function to initialize the app
async function initApp() {
    console.log('App initialized successfully.');
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
        const formData = new FormData();
        formData.append('referenceImage', file);

        const response = await fetch('https://your-backend.onrender.com/analyze_face', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }

        const collectionId = `face-collection-${Date.now()}`;
        displayUploadResults(collectionId, 'Reference Face');
        showPage('page3');
        await searchForFaceInImages(collectionId, file);
    } catch (error) {
        showError(`Error uploading face: ${error.message}`);
    }
}

// Function to search for the face in images listed from Google Drive
async function searchForFaceInImages(collectionId, referenceImage) {
    const searchResultsDiv = document.getElementById('resultsArea');
    searchResultsDiv.innerHTML = ''; // Clear previous results
    resetCounters();

    const targetImages = storedImages.map(image => `https://lh3.googleusercontent.com/d/${image.id}=s1000`);

    const formData = new FormData();
    formData.append('referenceImage', referenceImage);
    formData.append('targetImages', JSON.stringify(targetImages));

    try {
        const response = await fetch('https://your-backend.onrender.com/search_faces', {
            method: 'POST',
            body: formData
        });

        const results = await response.json();
        results.forEach((result, idx) => {
            const image = storedImages[idx];
            if (result.error) {
                const resultText = `${image.name} - Error searching for face: ${result.error}<br>`;
                appendResult(resultText);
                incrementCounter('notMatched');
            } else if (result['verified']) {
                const imageUrlDrive = `https://drive.google.com/file/d/${image.id}/view`;
                const resultText = `<a href="${imageUrlDrive}" target="_blank">${image.name}</a> - Face found<br>`;
                appendResult(resultText);
                incrementCounter('matched');
            } else {
                const resultText = `${image.name} - No face matches found<br>`;
                appendResult(resultText);
                incrementCounter('notMatched');
            }
        });
    } catch (error) {
        console.error('Error during face search:', error);
        showError('An error occurred while searching for faces.');
    }
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

// Function to display the upload results
function displayUploadResults(collectionId, faceId) {
    document.getElementById('uploadResults').innerText = `Face uploaded to collection '${collectionId}' with ID '${faceId}'`;
}

// Function to clear upload results
function clearUploadResults() {
    document.getElementById('uploadResults').innerText = '';
}

// Main functions exposed to the global scope
window.onload = async () => {
    await initApp();
    document.getElementById('analyzeFolderButton').addEventListener('click', processFolder);
    document.getElementById('uploadButton').addEventListener('click', uploadFace);
    document.getElementById('backButtonPage2').addEventListener('click', () => showPage('page1'));
    document.getElementById('backButtonPage3').addEventListener('click', () => showPage('page2'));
};