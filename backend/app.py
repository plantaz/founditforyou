from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from deepface import DeepFace
import cv2
import numpy as np
import requests
from io import BytesIO

app = Flask(__name__)

# Enable CORS for all routes and allow requests from your Netlify domain
CORS(app, resources={r"/*": {"origins": "https://founditforyou.netlify.app"}})

# Load environment variables
GOOGLE_API_KEY = os.getenv('MY_GOOGLE_API_KEY')

@app.route('/fetch_drive_files', methods=['POST', 'OPTIONS'])  # Add OPTIONS method for preflight
def fetch_drive_files():
    if request.method == 'OPTIONS':  # Handle preflight request
        return '', 200

    folder_id = request.json.get('folderId')
    next_page_token = request.json.get('nextPageToken')

    params = {
        'q': f"'{folder_id}' in parents",
        'key': GOOGLE_API_KEY,
        'fields': 'nextPageToken, files(id, name, mimeType)',
        'pageSize': 1000
    }

    if next_page_token:
        params['pageToken'] = next_page_token

    response = requests.get('https://www.googleapis.com/drive/v3/files', params=params)
    data = response.json()

    if 'error' in data:
        return jsonify({'error': data['error']['message']}), 500

    return jsonify(data)

@app.route('/analyze_face', methods=['POST', 'OPTIONS'])  # Add OPTIONS method for preflight
def analyze_face():
    if request.method == 'OPTIONS':  # Handle preflight request
        return '', 200

    reference_image = request.files.get('referenceImage')
    if not reference_image:
        return jsonify({'error': 'No reference image provided'}), 400

    # Save the reference image temporarily
    ref_img_path = 'reference_image.jpg'
    reference_image.save(ref_img_path)

    try:
        # Load the reference image for analysis
        img = cv2.imread(ref_img_path)
        result = DeepFace.analyze(img, actions=['age', 'gender', 'race', 'emotion'])
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up the temporary reference image
        if os.path.exists(ref_img_path):
            os.remove(ref_img_path)

@app.route('/search_faces', methods=['POST', 'OPTIONS'])  # Add OPTIONS method for preflight
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
    port = int(os.environ.get('PORT', 10000))  # Change default port to 10000
    app.run(debug=True, host='0.0.0.0', port=port)