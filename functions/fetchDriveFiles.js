const axios = require('axios');

exports.handler = async (event) => {
    const { folderId, nextPageToken } = JSON.parse(event.body);
    const GOOGLE_API_KEY = process.env.MY_GOOGLE_API_KEY;

    if (!GOOGLE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Google API Key is not defined' })
        };
    }

    try {
        const response = await axios.get(`https://www.googleapis.com/drive/v3/files`, {
            params: {
                q: `'${folderId}' in parents`,
                key: GOOGLE_API_KEY,
                fields: 'nextPageToken, files(id, name, mimeType)',
                pageSize: 1000
            }
        });

        return {
            statusCode: 200,
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        console.error('Error fetching drive files:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch drive files' })
        };
    }
};