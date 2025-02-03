from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests


app = Flask(__name__)

# Enable CORS for all routes and allow requests from your Netlify domain
CORS(app, resources={r"/*": {"origins": "https://founditforyou.netlify.app"}})

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv('MY_GOOGLE_API_KEY')

@app.route('/fetch_drive_files', methods=['POST', 'OPTIONS'])
def fetch_drive_files():
    if request.method == 'OPTIONS':  # Handle preflight request
        return '', 200

    if not GOOPLE_API_KEY:  # Debugging check for API key
        return jsonify({'error': 'Google API Key is not defined'}), 500

    folder_id = request.json.get('folderId')
    next_page_token = request.json.get('nextPageToken')

    params = {
        'q': f"'{folder_id}' in parents",
        'key': GOOGLE_API_KEY,  # Use the environment variable here
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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))  # Default port is 10000
    app.run(debug=True, host='0.0.0.0', port=port)