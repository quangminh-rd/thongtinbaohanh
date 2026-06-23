// admin.js – Quản lý lịch sử bảo hành

let allHistory = [];
let currentFilter = '';
let editingId = null;

const API_BASE = '/api/history';

// DOM refs
const tbody = document.getElementById('historyBody');
const totalSpan = document.getElementById('totalCount');
const form = document.getElementById('historyForm');
const editIdInput = document.getElementById('editId');
const maDonHangInput = document.getElementById('maDonHang');
const noiDungInput = document.getElementById('noiDung');
const nguoiThucHienInput = document.getElementById('nguoiThucHien');
const ketQuaInput = document.getElementById('ketQua');
const ngayBaoHanhInput = document.getElementById('ngayBaoHanh');
const submitBtn = document.getElementById('submitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const formTitle = document.getElementById('formTitle');
const formMessage = document.getElementById('formMessage');
const filterInput = document.getElementById('filterMaDonHang');
const filterBtn = document.getElementById('filterBtn');
const resetFilterBtn = document.getElementById('resetFilterBtn');

// Fetch và render
async function loadHistory(filter = '') {
    try {
        const url = filter ? `${API_BASE}?ma_don_hang=${encodeURIComponent(filter)}` : API_BASE;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Không thể tải dữ liệu');
        const data = await res.json();
        allHistory = data;
        renderTable(allHistory);
    } catch (error) {
        showMessage(error.message, 'error');
        tbody.innerHTML = `<tr><td colspan="7" class="cell-center">Lỗi tải dữ liệu</td></tr>`;
    }
}

function renderTable(records) {
    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="cell-center">Không có bản ghi nào</td></tr>`;
        totalSpan.textContent = '0 bản ghi';
        return;
    }
    let html = '';
    records.forEach((item, index) => {
        html += `
            <tr>
                <td class="cell-center">${index + 1}</td>
                <td class="cell-left">${escapeHtml(item.ma_don_hang)}</td>
                <td class="cell-left">${escapeHtml(item.noi_dung_bao_hanh)}</td>
                <td class="cell-left">${escapeHtml(item.nguoi_thuc_hien)}</td>
                <td class="cell-left">${escapeHtml(item.ket_qua)}</td>
                <td class="cell-center">${escapeHtml(item.ngay_bao_hanh)}</td>
                <td class="cell-center">
                    <button class="action-btn edit" data-id="${escapeHtml(item.id)}">Sửa</button>
                    <button class="action-btn delete" data-id="${escapeHtml(item.id)}">Xóa</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
    totalSpan.textContent = `${records.length} bản ghi`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

function showMessage(msg, type = 'error') {
    formMessage.textContent = msg;
    formMessage.className = 'form-message ' + type;
    formMessage.style.display = 'block';
    setTimeout(() => { formMessage.style.display = 'none'; }, 5000);
}

// Reset form về trạng thái thêm mới
function resetForm() {
    editingId = null;
    editIdInput.value = '';
    maDonHangInput.value = '';
    noiDungInput.value = '';
    nguoiThucHienInput.value = '';
    ketQuaInput.value = '';
    ngayBaoHanhInput.value = '';
    submitBtn.textContent = 'Thêm';
    formTitle.textContent = 'Thêm mới';
    cancelBtn.style.display = 'none';
    formMessage.style.display = 'none';
}

// Điền form để sửa
function fillFormForEdit(record) {
    editingId = record.id;
    editIdInput.value = record.id;
    maDonHangInput.value = record.ma_don_hang || '';
    noiDungInput.value = record.noi_dung_bao_hanh || '';
    nguoiThucHienInput.value = record.nguoi_thuc_hien || '';
    ketQuaInput.value = record.ket_qua || '';
    ngayBaoHanhInput.value = record.ngay_bao_hanh || '';
    submitBtn.textContent = 'Cập nhật';
    formTitle.textContent = 'Chỉnh sửa';
    cancelBtn.style.display = 'inline-block';
    formMessage.style.display = 'none';
}

// Xử lý submit form (thêm / sửa)
async function handleSubmit() {
    const maDonHang = maDonHangInput.value.trim();
    const noiDung = noiDungInput.value.trim();
    const nguoiThucHien = nguoiThucHienInput.value.trim();
    const ketQua = ketQuaInput.value.trim();
    const ngayBaoHanh = ngayBaoHanhInput.value;

    if (!maDonHang || !noiDung || !ngayBaoHanh) {
        showMessage('Vui lòng điền đầy đủ các trường bắt buộc (*)', 'error');
        return;
    }

    const payload = { ma_don_hang: maDonHang, noi_dung_bao_hanh: noiDung, nguoi_thuc_hien: nguoiThucHien, ket_qua: ketQua, ngay_bao_hanh: ngayBaoHanh };

    try {
        let url = API_BASE;
        let method = 'POST';
        if (editingId) {
            url += `?id=${encodeURIComponent(editingId)}`;
            method = 'PUT';
        }
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Lỗi khi lưu dữ liệu');
        showMessage(editingId ? 'Cập nhật thành công' : 'Thêm mới thành công', 'success');
        resetForm();
        // Tải lại danh sách với bộ lọc hiện tại
        const filter = filterInput.value.trim();
        loadHistory(filter);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Xóa bản ghi
async function handleDelete(id) {
    if (!confirm('Bạn có chắc muốn xóa bản ghi này?')) return;
    try {
        const res = await fetch(`${API_BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Xóa thất bại');
        showMessage('Xóa thành công', 'success');
        const filter = filterInput.value.trim();
        loadHistory(filter);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Tải dữ liệu ban đầu
    loadHistory();

    // Submit form
    submitBtn.addEventListener('click', handleSubmit);

    // Cancel edit
    cancelBtn.addEventListener('click', resetForm);

    // Filter
    filterBtn.addEventListener('click', () => {
        const filter = filterInput.value.trim();
        loadHistory(filter);
    });
    resetFilterBtn.addEventListener('click', () => {
        filterInput.value = '';
        loadHistory('');
    });
    // Cho phép Enter trong ô lọc
    filterInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') filterBtn.click();
    });

    // Sự kiện click trên bảng (delegation cho Edit/Delete)
    tbody.addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const id = target.dataset.id;
        if (!id) return;

        if (target.classList.contains('edit')) {
            // Tìm bản ghi trong allHistory
            const record = allHistory.find(item => item.id === id);
            if (record) {
                fillFormForEdit(record);
                // Cuộn lên form
                form.scrollIntoView({ behavior: 'smooth' });
            } else {
                showMessage('Không tìm thấy bản ghi', 'error');
            }
        } else if (target.classList.contains('delete')) {
            handleDelete(id);
        }
    });

    // Nếu người dùng nhấn Escape có thể reset form
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editingId) resetForm();
    });
});