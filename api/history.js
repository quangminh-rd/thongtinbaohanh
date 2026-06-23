import { google } from 'googleapis';

// Tên sheet
const SHEET_NAME = 'lich_su_bao_hanh';
// Thứ tự cột: A=id, B=ma_don_hang, C=noi_dung_bao_hanh, D=nguoi_thuc_hien, E=ket_qua, F=ngay_bao_hanh
const COL_MAP = {
    id: 0,
    ma_don_hang: 1,
    noi_dung_bao_hanh: 2,
    nguoi_thuc_hien: 3,
    ket_qua: 4,
    ngay_bao_hanh: 5
};

// Khởi tạo client Google Sheets với service account
function getAuthClient() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable');
    }
    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/spreadsheets']
    );
    return auth;
}

async function getSheetData(spreadsheetId, range) {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });
    return response.data.values || [];
}

async function updateSheetData(spreadsheetId, range, values) {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
    });
}

async function appendSheetData(spreadsheetId, range, values) {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
    });
}

async function deleteRow(spreadsheetId, sheetId, rowIndex) {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1, // 0-based, muốn xóa rowIndex (1-based)
                            endIndex: rowIndex,       // exclude end
                        },
                    },
                },
            ],
        },
    });
}

// Lấy sheetId của sheet theo tên
async function getSheetId(spreadsheetId, sheetName) {
    const auth = getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
    return sheet.properties.sheetId;
}

export default async function handler(req, res) {
    const spreadsheetId = process.env.SPREADSHEET_ID || '1BrEXyW5M9Sild-C0qFHmGxYaXq8Jfown0LiykKMTuhA';
    const range = `${SHEET_NAME}!A:F`;

    try {
        if (req.method === 'GET') {
            // Lọc theo ma_don_hang nếu có
            const { ma_don_hang } = req.query;
            let rows = await getSheetData(spreadsheetId, range);
            if (rows.length < 2) { // chỉ có header hoặc rỗng
                return res.status(200).json([]);
            }
            const headers = rows[0];
            const dataRows = rows.slice(1);
            const records = dataRows.map(row => {
                const obj = {};
                Object.keys(COL_MAP).forEach(key => {
                    obj[key] = row[COL_MAP[key]] || '';
                });
                return obj;
            });
            // Lọc theo mã đơn hàng nếu có
            let result = records;
            if (ma_don_hang) {
                const filter = ma_don_hang.trim();
                result = records.filter(r => r.ma_don_hang && r.ma_don_hang.includes(filter));
            }
            return res.status(200).json(result);
        }

        if (req.method === 'POST') {
            // Thêm mới: body { ma_don_hang, noi_dung_bao_hanh, nguoi_thuc_hien, ket_qua, ngay_bao_hanh }
            const { ma_don_hang, noi_dung_bao_hanh, nguoi_thuc_hien, ket_qua, ngay_bao_hanh } = req.body;
            if (!ma_don_hang || !noi_dung_bao_hanh || !ngay_bao_hanh) {
                return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
            }
            // Tạo id duy nhất: timestamp + random
            const id = Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6);
            const newRow = [
                id,
                ma_don_hang,
                noi_dung_bao_hanh,
                nguoi_thuc_hien || '',
                ket_qua || '',
                ngay_bao_hanh
            ];
            // Append
            await appendSheetData(spreadsheetId, range, [newRow]);
            return res.status(201).json({ id, ...req.body });
        }

        if (req.method === 'PUT') {
            // Cập nhật: ?id=xxx, body chứa các field cần update
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing id' });
            const { ma_don_hang, noi_dung_bao_hanh, nguoi_thuc_hien, ket_qua, ngay_bao_hanh } = req.body;

            // Lấy toàn bộ dữ liệu
            let rows = await getSheetData(spreadsheetId, range);
            if (rows.length < 2) return res.status(404).json({ error: 'No data' });
            // Tìm dòng có id trùng
            let rowIndex = -1;
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === id) {
                    rowIndex = i;
                    break;
                }
            }
            if (rowIndex === -1) return res.status(404).json({ error: 'Record not found' });

            // Cập nhật từng ô
            const row = rows[rowIndex];
            if (ma_don_hang !== undefined) row[COL_MAP.ma_don_hang] = ma_don_hang;
            if (noi_dung_bao_hanh !== undefined) row[COL_MAP.noi_dung_bao_hanh] = noi_dung_bao_hanh;
            if (nguoi_thuc_hien !== undefined) row[COL_MAP.nguoi_thuc_hien] = nguoi_thuc_hien;
            if (ket_qua !== undefined) row[COL_MAP.ket_qua] = ket_qua;
            if (ngay_bao_hanh !== undefined) row[COL_MAP.ngay_bao_hanh] = ngay_bao_hanh;

            // Cập nhật toàn bộ dòng
            const updateRange = `${SHEET_NAME}!A${rowIndex + 1}:F${rowIndex + 1}`;
            await updateSheetData(spreadsheetId, updateRange, [row]);
            return res.status(200).json({ message: 'Updated' });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) return res.status(400).json({ error: 'Missing id' });

            // Tìm vị trí dòng
            let rows = await getSheetData(spreadsheetId, range);
            if (rows.length < 2) return res.status(404).json({ error: 'No data' });
            let rowIndex = -1;
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === id) {
                    rowIndex = i;
                    break;
                }
            }
            if (rowIndex === -1) return res.status(404).json({ error: 'Record not found' });

            // Lấy sheetId
            const sheetId = await getSheetId(spreadsheetId, SHEET_NAME);
            // Xóa dòng (rowIndex là 1-based, startIndex là 0-based trước dòng cần xóa)
            await deleteRow(spreadsheetId, sheetId, rowIndex + 1);
            return res.status(200).json({ message: 'Deleted' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API History Error:', error);
        return res.status(500).json({ error: error.message || 'Server error' });
    }
}