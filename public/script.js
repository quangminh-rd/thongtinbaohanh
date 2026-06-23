let warrantyMain = null;
let warrantyItems = [];
let warrantyRules = [];

function getDataFromURI() {
    const url = window.location.href;
    const idURIMatch = url.match(/[?&]id=([^&#]*)/);
    const idURI = idURIMatch ? decodeURIComponent(idURIMatch[1]) : '';
    return { idURI };
}

function updateContent(message) {
    const contentElement = document.getElementById('content');
    if (contentElement) {
        contentElement.innerHTML = `<div class="status-box">${message}</div>`;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value)) return value;

    const s = String(value).trim();

    let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

    const parsed = new Date(s);
    return isNaN(parsed) ? null : parsed;
}

function formatDateDisplay(dateString) {
    if (!dateString) return '';
    const date = normalizeDate(dateString);
    if (!date) return String(dateString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseNumberFromSheet(value) {
    if (value === '' || value === null || value === undefined) return '';
    if (typeof value === 'number') return value;
    const normalized = String(value).replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? '' : num;
}

function formatNumberForDisplay(number) {
    if (number === '' || number === null || number === undefined) return '';
    return String(number).replace('.', ',');
}

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function fetchSheetValues(type) {
    const response = await fetch(`/api/sheets?type=${encodeURIComponent(type)}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Failed to load sheet data');
    }

    return data.values || [];
}

function rowToObject(headers, row) {
    const obj = {};
    headers.forEach((header, index) => {
        obj[header] = row[index] ?? '';
    });
    return obj;
}

function getValue(obj, ...keys) {
    for (const key of keys) {
        const normalized = normalizeKey(key);
        if (Object.prototype.hasOwnProperty.call(obj, normalized)) {
            return obj[normalized];
        }
    }
    return '';
}

function addMonths(date, months) {
    const result = new Date(date.getTime());
    const desiredDay = result.getDate();
    result.setMonth(result.getMonth() + months);
    if (result.getDate() < desiredDay) {
        result.setDate(0);
    }
    return result;
}

function startOfDay(date) {
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysBetween(startDate, endDate) {
    const start = startOfDay(startDate);
    const end = startOfDay(endDate);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function formatDescription(text) {
    return escapeHtml(text)
        .replace(/\r\n/g, '<br>')
        .replace(/\n/g, '<br>')
        .replace(/\r/g, '<br>');
}

document.addEventListener('DOMContentLoaded', async () => {
    initWarrantyToggleBehavior();
    try {
        const { idURI } = getDataFromURI();
        if (!idURI) {
            updateContent('Thiếu tham số <b>id</b> trên URL.');
            return;
        }

        await findMainInfo(idURI);
        await loadWarrantyRules();
        await findDetailInfo(idURI);
    } catch (error) {
        updateContent('Initialization error: ' + error.message);
        console.error(error);
    }
});

async function findMainInfo(maDonHang) {
    try {
        const rows = await fetchSheetValues('main');
        const row = rows.find(r => (r[0] || '') === maDonHang);

        if (!row) {
            updateContent(`Không tìm thấy dữ liệu bảo hành cho mã đơn hàng: <b>${escapeHtml(maDonHang)}</b>`);
            return;
        }

        warrantyMain = {
            maDonHang: row[0] || '',
            tenNguoiLienHe: row[1] || '',
            diaChiChiTiet: row[2] || '',
            sdtKhachHang: row[3] || '',
            maHopDong: row[4] || '',
            ngayBanGiao: row[5] || '',
        };

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        const deliveryText = formatDateDisplay(warrantyMain.ngayBanGiao) || warrantyMain.ngayBanGiao || '';
        setText('heroMaDonHang', warrantyMain.maDonHang);
        setText('tenNguoiLienHe', warrantyMain.tenNguoiLienHe);
        setText('diaChiChiTiet', warrantyMain.diaChiChiTiet);
        setText('sdtKhachHang', warrantyMain.sdtKhachHang);
        setText('heroMaHopDong', warrantyMain.maHopDong);
        setText('maHopDong', warrantyMain.maHopDong);
        setText('heroNgayBanGiao', deliveryText);
        setText('ngayBanGiao', deliveryText);
    } catch (error) {
        updateContent('Error fetching main data: ' + error.message);
        console.error('Fetch Error:', error);
    }
}

async function loadWarrantyRules() {
    try {
        const rows = await fetchSheetValues('rule');
        if (!rows.length) {
            warrantyRules = [];
            return;
        }

        const headers = rows[0].map(normalizeKey);
        warrantyRules = rows.slice(1).map(row => rowToObject(headers, row));
    } catch (error) {
        console.error('Error loading warranty rules:', error);
        warrantyRules = [];
    }
}

function getApplicableRule(maSanPham, ngayBanGiao) {
    const productCode = String(maSanPham || '').trim();
    if (!productCode || !warrantyRules.length) return null;

    const targetDate = normalizeDate(ngayBanGiao);

    const matched = warrantyRules
        .filter(rule =>
            String(getValue(rule, 'ma_san_pham', 'masanpham')).trim() === productCode
        )
        .map(rule => ({
            ...rule,
            _applyDate: normalizeDate(
                getValue(rule, 'thoi_diem_ap_dung', 'thoi_diemap_dung')
            )
        }))
        .filter(rule => rule._applyDate);

    if (!matched.length) return null;

    // Có ngày bàn giao => lấy phiên bản gần nhất trước ngày bàn giao
    if (targetDate) {
        const validRules = matched
            .filter(rule => rule._applyDate <= targetDate)
            .sort((a, b) => b._applyDate - a._applyDate);

        if (validRules.length) {
            return validRules[0];
        }
    }

    // Không có ngày bàn giao hoặc không tìm thấy bản phù hợp
    // => lấy bản có thời điểm áp dụng gần hiện tại nhất
    return matched.sort((a, b) => b._applyDate - a._applyDate)[0];
}

function sanitizeUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch (e) {
        return '';
    }
    return '';
}

function buildGuideButton(url) {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return '<span style="color:var(--muted);">—</span>';
    return `<a class="guide-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Xem</a>`;
}

function getWarrantyStatusClass(remainingDays) {
    if (remainingDays < 0) return 'is-expired';
    if (remainingDays <= 30) return 'is-warning';
    return 'is-ok';
}


function buildWarrantyMiniTable(rule, ngayBanGiao) {
    if (!rule) return '';

    const deliveryDate = normalizeDate(ngayBanGiao);
    const rowsHtml = [];

    for (let index = 1; index <= 5; index++) {
        const criterion = getValue(rule, `tieu_chi_bao_hanh_${index}`, `tieu_chi_bao_hanh${index}`, `tieu_chi_${index}`);
        const monthsRaw = getValue(rule, `time_${index}`, `time${index}`);
        const monthsParsed = parseFloat(String(monthsRaw).replace(',', '.'));

        if (!criterion && (monthsRaw === '' || monthsRaw === null || monthsRaw === undefined)) {
            continue;
        }

        let expiryText = '';
        let remainingText = '-';
        let statusClass = '';

        if (!deliveryDate) {

            expiryText = 'Chưa kích hoạt';
            remainingText = `-`;
            statusClass = 'is-warning';

        } else if (!isNaN(monthsParsed)) {

            const expiryDate = addMonths(deliveryDate, monthsParsed);
            const remainingDays = daysBetween(new Date(), expiryDate);

            expiryText = formatDateDisplay(expiryDate);
            statusClass = getWarrantyStatusClass(remainingDays);

            if (remainingDays > 0) {
                remainingText = `<span class="warranty-icon">⏰</span><span>${remainingDays} ngày</span>`;
            } else if (remainingDays === 0) {
                remainingText = `<span class="warranty-icon">⚠️</span><span>Hết hạn hôm nay</span>`;
                statusClass = 'is-warning';
            } else {
                remainingText = `<span class="warranty-icon">❌</span><span>Hết hạn bảo hành</span>`;
                statusClass = 'is-expired';
            }

        } else {

            expiryText = '-';
        }

        rowsHtml.push(`
                    <tr>
                        <td>${criterion ? `<span class="warranty-criterion">${escapeHtml(criterion)}</span>` : '<span style="color:var(--muted);">—</span>'}</td>
                        <td class="cell-center"><span class="warranty-date ${statusClass}">${escapeHtml(expiryText)}</span></td>
                        <td class="cell-center">${remainingText !== '-' ? `<span class="warranty-remaining ${statusClass}">${remainingText}</span>` : '<span class="warranty-remaining">-</span>'}</td>
                    </tr>
                `);
    }

    if (!rowsHtml.length) {
        return '';
    }

    const deliveryLabel = deliveryDate ? formatDateDisplay(deliveryDate) : '-';
    return `
                <div class="warranty-panel">
                    <table>
                        <thead>
                            <tr>
                                <th class="cell-left">Tiêu chí bảo hành</th>
                                <th style="width: 20%;" class="cell-center">Hạn bảo hành</th>
                                <th style="width: 20%;" class="cell-center">Còn lại</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml.join('')}
                        </tbody>
                    </table>
                </div>
            `;
}

async function findDetailInfo(maDonHang) {

    try {
        const rows = await fetchSheetValues('detail');

        const filteredRows = rows.filter(row =>
            String(row[1] || '').trim() === String(maDonHang || '').trim()
        );

        // Sort theo cột STT (row[2])
        filteredRows.sort((a, b) =>
            String(a[2] || '').localeCompare(
                String(b[2] || ''),
                undefined,
                { numeric: true }
            )
        );

        warrantyItems = filteredRows.map(extractDetailDataFromRow);

        if (!filteredRows.length) {
            const tableBody = document.getElementById('itemTableBody');
            tableBody.innerHTML = `<tr><td colspan="9" class="cell-center">Không có sản phẩm</td></tr>`;
            return;
        }

        displayDetailData(filteredRows);

    } catch (error) {
        console.error('Error fetching detail data:', error);
        updateContent('Error fetching detail data.');
    }
}

function extractDetailDataFromRow(row) {
    const qtyRaw = row[7];
    const qtyParsed = parseNumberFromSheet(qtyRaw);
    return {
        maDonHang: row[1] || '',
        stt: row[2] || '',
        maSanPham: row[3] || '',
        dienGiai: row[4] || '',
        chieuRong: row[5] || '',
        chieuCao: row[6] || '',
        soLuong: formatNumberForDisplay(qtyParsed),
        soLuongParsed: qtyParsed,
        ngayBanGiao: row[8] || '',
    };
}

function displayDetailData(filteredRows) {
    const tableBody = document.getElementById('itemTableBody');
    let html = '';

    filteredRows.forEach((row, index) => {
        const item = extractDetailDataFromRow(row);

        const effectiveDeliveryDate = item.ngayBanGiao || (warrantyMain ? warrantyMain.ngayBanGiao : '');
        const rule = getApplicableRule(item.maSanPham, effectiveDeliveryDate);
        const warrantyHtml = buildWarrantyMiniTable(rule, effectiveDeliveryDate);
        const hdsdHtml = rule ? buildGuideButton(getValue(rule, 'hdsd_url')) : '<span style="color:var(--muted);">—</span>';
        const hdldHtml = rule ? buildGuideButton(getValue(rule, 'hdld_url')) : '<span style="color:var(--muted);">—</span>';
        const detailId = `warranty-detail-${index}`;

        html += `
                    <tr class="item-main-row">
                        <td class="cell-center">${escapeHtml(item.stt)}</td>
                        <td class="cell-left">${escapeHtml(item.maSanPham)}</td>
                        <td class="cell-left">${formatDescription(item.dienGiai)}</td>
                        <td class="cell-center">${escapeHtml(item.chieuRong)}</td>
                        <td class="cell-center">${escapeHtml(item.chieuCao)}</td>
                        <td class="cell-center">${escapeHtml(item.soLuong)}</td>
                        <td class="cell-center">${hdsdHtml}</td>
                        <td class="cell-center">${hdldHtml}</td>
                        <td class="cell-center">
                            ${warrantyHtml ? `<button type="button" class="warranty-toggle" data-target="${detailId}" aria-expanded="false">Xem</button>` : '<span style="color:var(--muted);">—</span>'}
                        </td>
                    </tr>
                `;

        if (warrantyHtml) {
            html += `
                        <tr class="warranty-detail-row" id="${detailId}" hidden>
                            <td colspan="9" class="warranty-detail-cell">
                                ${warrantyHtml}
                            </td>
                        </tr>
                    `;
        }
    });

    tableBody.innerHTML = html;
}

function initWarrantyToggleBehavior() {
    const tableBody = document.getElementById('itemTableBody');
    if (!tableBody || tableBody.dataset.toggleBound === '1') return;

    tableBody.dataset.toggleBound = '1';
    tableBody.addEventListener('click', (event) => {
        const button = event.target.closest('.warranty-toggle');
        if (!button) return;

        const targetId = button.getAttribute('data-target');
        const row = document.getElementById(targetId);
        if (!row) return;

        const willOpen = row.hidden;
        row.hidden = !willOpen;
        button.textContent = willOpen ? 'Ẩn' : 'Xem';
        button.setAttribute('aria-expanded', String(willOpen));
    });
}

// Đảm bảo sự kiện vẫn hoạt động sau khi DOM thay đổi
document.addEventListener('click', function (e) {
    const button = e.target.closest('.warranty-toggle');
    if (!button) return;
    const targetId = button.getAttribute('data-target');
    const row = document.getElementById(targetId);
    if (!row) return;
    const willOpen = row.hidden;
    row.hidden = !willOpen;
    button.textContent = willOpen ? 'Ẩn' : 'Xem';
    button.setAttribute('aria-expanded', String(willOpen));
});