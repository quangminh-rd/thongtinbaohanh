export default async function handler(req, res) {

    console.log("SPREADSHEET_ID:", process.env.SPREADSHEET_ID);
    console.log("GOOGLE_SHEETS_API_KEY:", process.env.GOOGLE_SHEETS_API_KEY);
    try {
        const { type } = req.query;

        const spreadsheetId =
            process.env.SPREADSHEET_ID ||
            '1BrEXyW5M9Sild-C0qFHmGxYaXq8Jfown0LiykKMTuhA';

        const apiKey =
            process.env.GOOGLE_SHEETS_API_KEY ||
            'AIzaSyA9g2qFUolpsu3_HVHOebdZb0NXnQgXlFM';

        if (!spreadsheetId || !apiKey) {
            return res.status(500).json({
                error: 'Missing environment variables'
            });
        }

        const ranges = {
            main: 'du_lieu_bao_hanh!A:Z',
            detail: 'du_lieu_bao_hanh_chi_tiet!A:Z',
            rule: 'quy_dinh_bh_hdsd_hdld!A:Z'
        };

        const range = ranges[type];
        if (!range) {
            return res.status(400).json({
                error: 'Invalid type. Use main, detail, or rule.'
            });
        }

        const url =
            `https://sheets.googleapis.com/v4/spreadsheets/` +
            `${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            error: error.message || 'Server error'
        });
    }
}