from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from deepface import DeepFace
import cv2
import numpy as np
import requests
from io import BytesIO

# Preload the Facenet model during app startup
print("Loading Facenet model...")
DeepFace.build_model("Facenet")  # Preload the Facenet model
print("Facenet model loaded successfully.")

app = Flask(__name__)

# Enable CORS for all routes and allow requests from your Netlify domain
CORS(app, resources={r"/*": {"origins": "https://founditforyou.netlify.app"}})

# Load environment variables
GOOGLE_API_KEY = os.getenv('MY_GOOGLE_API_KEY')

@app.route('/fetch_drive_files', methods=['POST', 'OPTIONS'])
def fetch_drive_files():
    if request.method == 'OPTIONS':  # Handle preflight request
        return '', 200

    folder_id = request.json.get('folderId')
    next_page_token = request.json.get('nextPageToken')

    params = {
        'q': f"'{folder_id}' in parents",
        'key': GOOGLE_API_KEY,  # Use the correct environment variable
        'fields': 'nextPageToken, files(id, name, mimeType)',
        'pageSize': 1000
    }

    if next_page_token:
        params['pageToken'] = next_page_token

    try:
        response = requests.get('https://www.googleapis.com/drive/v3/files', params=params)
        data = response.json()

        if response.status_code != 200 or 'error' in data:
            return jsonify({'error': data.get('error', {}).get('message', 'Unknown error')}), 500

        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/analyze_face', methods=['POST', 'OPTIONS'])
def analyze_face():
    if request.method == 'OPTIONS':  # Handle preflight request
        return '', 200

    reference_image = request.files.get('referenceImage')
    if not reference_image:
        return jsonify({'error': 'No reference image provided'}), 400

    # Check file size (limit to 5 MB)
    max_size = 5 * 1024 * 1024  # 5 MB
    if len(reference_image.read()) > max_size:
        return jsonify({'error': 'File size exceeds 5 MB limit'}), 413  # HTTP 413 Payload Too Large

    # Reset file pointer after checking size
    reference_image.seek(0)

    # Save the reference image temporarily
    ref_img_path = 'reference_image.jpg'
    reference_image.save(ref_img_path)

    try:
        # Resize the image to reduce memory usage
        img = cv2.imread(ref_img_path)
        if img is None:
            return jsonify({'error': 'Invalid image format'}), 400

        img = cv2.resize(img, (160, 160))  # Resize to 160x160 pixels

        # Perform face analysis using DeepFace
        result = DeepFace.analyze(img, actions=['age', 'gender', 'race', 'emotion'], enforce_detection=False)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the temporary reference image
        if os.path.exists(ref_img_path):
            os.remove(ref_img_path)


@app.route('/search_faces', methods=['POST', 'OPTIONS'])  # Ensure this route exists
def search_faces():
    if request.method == 'OPTIONS':  # Handle preflight request
        return '', 200

    reference_image = request.files.get('referenceImage')
    target_images = request.json.get('targetImages')

    if not reference_image or not target_images:
        return jsonify({'error': 'Missing reference image or target images'}), 400

    # Save the reference image temporarily
    ref_img_path = 'reference_image.jpg'
    reference_image.save(ref_img_path)

    results = []
    for target_image_url in target_images:
        try:
            # Fetch the target image from Google Drive
            response = requests.get(target_image_url)
            img_bytes = BytesIO(response.content)
            img_array = np.asarray(bytearray(img_bytes.read()), dtype=np.uint8)
            target_img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

            # Perform face verification
            verification_result = DeepFace.verify(
                img1_path=ref_img_path,
                img2_path=target_img,
                model_name="Facenet"  # Use Facenet for better accuracy
            )
            results.append(verification_result)
        except Exception as e:
            results.append({'error': str(e)})

    # Clean up the temporary reference image
    if os.path.exists(ref_img_path):
        os.remove(ref_img_path)

    return jsonify(results)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))  # Default port is 10000
    app.run(debug=True, host='0.0.0.0', port=port)