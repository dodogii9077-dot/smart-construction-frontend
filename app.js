const BASE_URL = "https://smart-construction-backend-2.onrender.com";

const state = {
    token: localStorage.getItem("token") || null,
    user: null,
};

// ==========================
// 1. 초기화 및 공통 로직
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    const dateEl = document.getElementById('header-date');
    if(dateEl) {
        const now = new Date();
        dateEl.innerText = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    }

    if (state.token) {
        initApp();
    } else {
        showAuthTab('login');
    }
});

// ==========================
// 2. 인증 (로그인/회원가입)
// ==========================
// ==========================
// 🔥 현장 목록 불러오기 (공용)
// ==========================
async function loadSites() {
    try {
        const res = await fetch(`${BASE_URL}/public/sites`);
        const sites = await res.json();

        const siteSelect = document.getElementById("signup-site-id");
        siteSelect.innerHTML = `<option value="">소속 현장 선택</option>`;

        sites.forEach(site => {
            const op = document.createElement("option");
            op.value = site.id;
            op.textContent = `${site.name} (${site.location || "위치 없음"})`;
            siteSelect.appendChild(op);
        });

        console.log("사이트 목록 로드됨:", sites);
    } catch (err) {
        console.error("현장 목록 불러오기 실패:", err);
    }
}

function showAuthTab(tab) {
    document.querySelectorAll('.toggle-switch button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        document.getElementById('btn-login').classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.getElementById('btn-signup').classList.add('active');
        document.getElementById('signup-form').classList.add('active');

        // 🔥 회원가입 화면이 열릴 때 현장 목록 불러오기
        loadSites();
    }
}


document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<span class="material-icons-round logo-spin" style="font-size:1.2rem;">refresh</span> 로그인 중...';

    const formData = new FormData();
    formData.append("username", document.getElementById('login-username').value);
    formData.append("password", document.getElementById('login-password').value);

    try {
        const res = await fetch(`${BASE_URL}/login`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("로그인 실패");
        const data = await res.json();
        state.token = data.access_token;
        localStorage.setItem("token", state.token);
        initApp();
        showToast("환영합니다! 접속 성공 ✨");
    } catch (err) {
        showToast("아이디 또는 비밀번호를 확인해주세요.", true);
        btn.innerHTML = originalBtnText;
    }
});

function toggleSiteCreation() {
    const role = document.querySelector('input[name="role"]:checked').value;
    const createGroup = document.getElementById('site-create-group');
    if (role === 'manager') createGroup.classList.remove('hidden');
    else createGroup.classList.add('hidden');
}

function toggleNewSiteInputs() {
    const isNew = document.getElementById('is-new-site').checked;
    const inputs = document.getElementById('new-site-inputs');
    const select = document.getElementById('site-select-group');
    if (isNew) { inputs.classList.remove('hidden'); select.classList.add('hidden'); }
    else { inputs.classList.add('hidden'); select.classList.remove('hidden'); }
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const role = document.querySelector('input[name="role"]:checked').value;
    const isNewSite = document.getElementById('is-new-site').checked;

    // [중요] 400 에러 방지 로직: 현장 ID가 없거나 문자인 경우를 방지
    let siteIdVal = document.getElementById('signup-site-id').value;
    let siteId = (siteIdVal && !isNewSite) ? parseInt(siteIdVal) : null;

    if (role === 'manager' && !isNewSite && !siteId) {
         showToast("참여할 현장을 선택하거나 새 현장을 개설해주세요.", true);
         return;
    }
    if (role === 'worker' && !siteId) {
        showToast("소속될 현장을 선택해주세요. (목록에 없으면 관리자에게 문의)", true);
        return;
    }

    const payload = {
        username: document.getElementById('signup-username').value,
        password: document.getElementById('signup-password').value,
        full_name: document.getElementById('signup-fullname').value,
        birth_date: document.getElementById('signup-birth').value,
        gender: document.getElementById('signup-gender').value,
        trade_type: document.getElementById('signup-trade') ? document.getElementById('signup-trade').value : '없음',
        phone: document.getElementById('signup-phone').value,
        email: "test@example.com",
        role: role,
        site_id: siteId,
        site_name: isNewSite ? document.getElementById('new-site-name').value : null,
        site_location: isNewSite ? document.getElementById('new-site-loc').value : null
    };

    try {
        const res = await fetch(`${BASE_URL}/signup`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "가입 처리 중 오류 발생");
        }

        showToast("가입 완료! 로그인해주세요. 🎉");
        showAuthTab('login');
    } catch (err) {
        console.error(err);
        showToast(err.message, true);
    }
});

function logout() {
    localStorage.removeItem("token");
    location.reload();
}

// ==========================
// 3. 앱 구동 및 라우팅
// ==========================
async function initApp() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');

    try {
        const user = await apiFetch('/me');
        state.user = user;

        document.getElementById('user-avatar').innerText = user.full_name[0];
        document.getElementById('nav-username').innerText = user.full_name;
        document.getElementById('nav-role').innerText = user.role.toUpperCase();
        document.getElementById('current-site-name').innerText = `Site #${user.site_id}`;

        if (user.role === 'manager') {
            document.getElementById('menu-workers').classList.remove('hidden');
        }

        renderView('dashboard');
    } catch (err) {
        logout();
    }
}

async function renderView(view) {
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.menu-btn[data-target="${view}"]`);
    if(btn) btn.classList.add('active');

    const container = document.getElementById('content-area');
    const titleMap = {
        dashboard: '대시보드',
        attendance: '출석 체크',
        notices: '공지사항',
        alerts: '비상 알림',
        issues: '하자 신고',
        drawings: '도면 관리',
        processes: '공정 관리',
        workers: '근로자 관리',
        profile: '내 정보',
    };
    document.getElementById('page-title').innerText = titleMap[view] || 'Dashboard';

    container.innerHTML = getSkeleton();
    await new Promise(r => setTimeout(r, 400));

    try {
        if(view === 'dashboard') await loadDashboard(container);
        else if(view === 'attendance') await loadAttendance(container);
        else if(view === 'notices') await loadNotices(container);
        else if(view === 'alerts') await loadAlerts(container);
        else if(view === 'issues') await loadIssues(container);
        else if(view === 'drawings') await loadDrawings(container);
        else if(view === 'processes') await loadProcesses(container);
        else if(view === 'workers') await loadWorkers(container);
        else if (view === 'profile') await loadProfile(container);
        applyStagger();
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="card"><p>데이터 로드 실패: ${e.message}</p></div>`;
    }
}

// ==========================
// 4. UI 헬퍼 함수
// ==========================
function getSkeleton() {
    return `
    <div class="grid-2-sm stagger-appear">
        <div class="card" style="height:200px; background:rgba(255,255,255,0.4);"></div>
        <div class="card" style="height:200px; background:rgba(255,255,255,0.4);"></div>
    </div>
    <div class="card stagger-appear" style="height:300px; margin-top:20px; background:rgba(255,255,255,0.4);"></div>`;
}

function applyStagger() {
    const items = document.querySelectorAll('.card, .list-item, .notice-card');
    items.forEach((el, i) => {
        el.classList.add('stagger-appear');
        el.style.animationDelay = `${i * 0.1}s`;
    });
}

// ==========================
// 5. 기능별 로직 (실제 데이터)
// ==========================

// [대시보드]
async function loadDashboard(container) {
    container.innerHTML = `
        <div class="grid-2-sm">
            <div class="card welcome-card" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;">
                <h3 id="typing-text" style="font-size:1.5rem; margin-bottom:10px;"></h3>
                <p style="opacity:0.9;">오늘도 안전 수칙을 준수해주세요! 🚧</p>
                <div style="margin-top:20px; display:flex; gap:10px;">
                    <span class="status-badge" style="background:rgba(255,255,255,0.2);">Role: ${state.user.role}</span>
                    <span class="status-badge" style="background:rgba(255,255,255,0.2);">Trade: ${state.user.trade_type || '공통'}</span>
                </div>
            </div>
            <div class="card">
                <h3><span class="material-icons-round" style="color:#ec4899;">pie_chart</span> ${state.user.role === 'manager' ? '오늘 현장 출석율' : '나의 출석 통계'}</h3>
                <div class="chart-container" style="height:180px; display:flex; justify-content:center;">
                    <canvas id="doughnutChart"></canvas>
                </div>
            </div>
        </div>
        <div class="card" style="margin-top:20px;">
            <h3><span class="material-icons-round" style="color:#6366f1;">show_chart</span> 최근 7일 근무 시간 (시간)</h3>
            <div class="chart-container">
                <canvas id="lineChart"></canvas>
            </div>
        </div>
    `;

    const text = `반갑습니다, ${state.user.full_name}님!`;
    let i = 0;
    const typeTarget = document.getElementById('typing-text');
    function typeWriter() {
        if (typeTarget && i < text.length) {
            typeTarget.innerHTML += text.charAt(i);
            i++;
            setTimeout(typeWriter, 50);
        }
    }
    typeWriter();

    let doughnutData = [];
    let lineData = { labels: [], data: [] };

    try {
        if (state.user.role === 'manager') {
            const [users, todayAtt, myAtt] = await Promise.all([
                apiFetch('/manager/users'),
                apiFetch('/manager/attendance/today'),
                apiFetch('/attendance/me')
            ]);
            const totalUsers = users.length;
            const present = todayAtt.filter(a => a.check_in_status === '정상 출근').length;
            const late = todayAtt.filter(a => a.check_in_status === '지각').length;
            const absent = totalUsers > 0 ? totalUsers - todayAtt.length : 0;
            doughnutData = [present, late, absent];
            processLineChartData(myAtt, lineData);
        } else {
            const myAtt = await apiFetch('/attendance/me');
            const present = myAtt.filter(a => a.check_in_status === '정상 출근').length;
            const late = myAtt.filter(a => a.check_in_status === '지각').length;
            const earlyLeave = myAtt.filter(a => a.check_out_status === '조퇴').length;
            doughnutData = [present, late, earlyLeave];
            processLineChartData(myAtt, lineData);
        }

        const doughnutLabels = state.user.role === 'manager' ? ['정상 출근', '지각', '미출근'] : ['정상 출근', '지각', '조퇴'];
        const doughnutColors = state.user.role === 'manager' ? ['#10b981', '#fbbf24', '#cbd5e1'] : ['#6366f1', '#fbbf24', '#ef4444'];

        new Chart(document.getElementById('doughnutChart'), {
            type: 'doughnut',
            data: {
                labels: doughnutLabels,
                datasets: [{ data: doughnutData, backgroundColor: doughnutColors, borderWidth: 0, hoverOffset: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } }
        });

        new Chart(document.getElementById('lineChart'), {
            type: 'line',
            data: {
                labels: lineData.labels,
                datasets: [{
                    label: '근무 시간', data: lineData.data, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true, tension: 0.4, pointBackgroundColor: '#fff', pointBorderColor: '#6366f1', pointRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
        });

    } catch (e) {
        console.error("차트 로드 실패", e);
    }
}

function processLineChartData(records, outputObj) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        outputObj.labels.push(`${days[d.getDay()]}(${d.getDate()}일)`);

        const record = records.find(r => r.date === dateStr);
        if (record && record.check_in_time && record.check_out_time) {
            const start = new Date(record.check_in_time);
            const end = new Date(record.check_out_time);
            outputObj.data.push(((end - start) / (1000 * 60 * 60)).toFixed(1));
        } else {
            outputObj.data.push(0);
        }
    }
}

// [출석 관리]
async function loadAttendance(container) {
    const list = await apiFetch('/attendance/me');
    const isManager = state.user.role === 'manager';

    container.innerHTML = `
        <div class="grid-2-sm">
            <button onclick="checkAction('/attendance/check-in', '출근')" class="card gradient-btn"
                style="text-align:center; height:auto; display:flex; flex-direction:column; align-items:center;">
                <span class="material-icons-round" style="font-size:2rem; margin-bottom:10px;">wb_sunny</span>
                출근 체크하기
            </button>
            <button onclick="checkAction('/attendance/check-out', '퇴근')" class="card"
                style="text-align:center; height:auto; display:flex; flex-direction:column; align-items:center;
                       background:#1e293b; color:white; border:none;">
                <span class="material-icons-round" style="font-size:2rem; margin-bottom:10px;">nights_stay</span>
                퇴근 체크하기
            </button>
        </div>

        <div class="card">
            <h3>내 기록</h3>

            ${isManager ? `
            <!-- ✅ 관리자에게만 보이는 엑셀 다운로드 버튼 -->
            <button onclick="downloadAttendanceCsv()" class="gradient-btn"
                style="width:auto; margin-bottom:10px;">
                출석 기록 엑셀 다운로드
            </button>
            ` : ''}

            <div id="att-list"></div>
        </div>
    `;

    const listEl = document.getElementById('att-list');
    list.forEach(item => {
        listEl.innerHTML += `
            <div class="list-item notice">
                <div>
                    <strong>${item.date}</strong>
                    <div style="font-size:0.8rem; color:#666;">
                        ${formatTime(item.check_in_time)} ~ ${formatTime(item.check_out_time)}
                    </div>
                </div>
                <span class="status-badge ${item.check_in_status === '지각' ? 'danger' : 'success'}">
                    ${item.check_in_status || '미출근'}
                </span>
            </div>
        `;
    });
}

async function checkAction(url, name) {
    try { await apiFetch(url, 'POST'); showToast(`${name} 완료!`); renderView('attendance'); }
    catch(e) { showToast(e.message, true); }
}

// [공지사항]
async function loadNotices(container) {
    const notices = await apiFetch('/notices');
    let html = '';

    if (state.user.role === 'manager') {
        html += `
        <div class="glass-card stagger-appear" style="border-left: 5px solid #6366f1; margin-bottom: 2rem;">
            <h3 style="margin-bottom:15px; color:#6366f1;"><span class="material-icons-round">edit_note</span> 새 공지 등록</h3>
            <div class="floating-input"><input type="text" id="n-title" required placeholder=" "><label>공지 제목</label></div>
            <textarea id="n-content" class="simple-input" placeholder="내용..." style="height:100px; resize:none;"></textarea>
            <div style="text-align:right; margin-top:10px;"><button onclick="postNotice()" class="gradient-btn">등록하기</button></div>
        </div>
        <h3 class="stagger-appear" style="margin-bottom:15px; margin-left:5px; color:var(--text-sub);">📢 공지 목록</h3>`;
    } else {
        html += `<h3 class="stagger-appear" style="margin-bottom:15px; margin-left:5px;">📢 현장 공지사항</h3>`;
    }

    html += '<div class="notice-list-container">';
    if (notices.length === 0) {
        html += `<div class="empty-state stagger-appear"><span class="material-icons-round" style="font-size:4rem; color:#cbd5e1;">notifications_off</span><p>등록된 공지사항이 없습니다.</p></div>`;
    } else {
        notices.forEach((n, index) => {
            const dateObj = new Date(n.created_at);
            const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
            html += `
            <div class="glass-card notice-card stagger-appear" style="animation-delay: ${index * 0.1}s;">
                <div class="notice-header"><span class="badge-tag">공지</span><span class="notice-date">${dateStr}</span></div>
                <h4 class="notice-title">${n.title}</h4>
                <p class="notice-content">${n.content}</p>
                <div class="notice-footer">
                    <div class="writer-info"><div class="avatar-mini">${n.writer_full_name[0]}</div><span>${n.writer_full_name} (관리자)</span></div>
                    ${state.user.role === 'manager' ? `<button onclick="delNotice(${n.id})" class="icon-btn delete-btn"><span class="material-icons-round">delete_outline</span></button>` : ''}
                </div>
            </div>`;
        });
    }
    html += '</div>';
    container.innerHTML = html;
}

async function postNotice() {
    const title = document.getElementById('n-title').value;
    const content = document.getElementById('n-content').value;
    if(!title || !content) return showToast("제목과 내용을 입력해주세요.", true);
    try { await apiFetch('/manager/notices', 'POST', {title, content}); showToast("등록됨"); renderView('notices'); }
    catch(e) { showToast(e.message, true); }
}
async function delNotice(id) { if(confirm('삭제하시겠습니까?')) { try { await apiFetch(`/manager/notices/${id}`, 'DELETE'); showToast("삭제됨"); renderView('notices'); } catch(e){ showToast("삭제 실패", true); } } }

// [비상 알림 - 선택 기능]
async function loadAlerts(container) {
    let alerts = state.user.role==='manager' ? await apiFetch('/manager/alerts/emergency') : await apiFetch('/alerts/emergency/me');
    let html = `<div class="card" style="background:#fff1f2; border:1px solid #fda4af;">
        <h3 style="color:#be123c;"><span class="material-icons-round">campaign</span> 긴급 신고</h3>

        <div class="grid-2-sm">
            <div>
                <label style="font-size:0.8rem; color:#be123c; font-weight:bold;">상황 선택</label>
                <select id="a-type" class="simple-input" onchange="toggleAlertInput()">
                    <option value="응급환자 발생">🚑 응급환자 발생</option>
                    <option value="화재 발생">🔥 화재 발생</option>
                    <option value="사고 발생">💥 사고 발생 (추락/협착 등)</option>
                    <option value="기타">💬 기타 (직접 입력)</option>
                </select>
            </div>
            <div>
                <label style="font-size:0.8rem; color:#be123c; font-weight:bold;">위치</label>
                <input id="a-loc" class="simple-input" placeholder="예: 2층 계단실">
            </div>
        </div>
        <input id="a-msg-detail" class="simple-input hidden" placeholder="상황을 자세히 입력해주세요">

        <button onclick="postAlert()" class="gradient-btn" style="background:#be123c; margin-top:10px;">🚨 신고하기</button>
    </div>`;

    alerts.forEach(a => {
        html += `<div class="list-item alert">
            <div><strong>${a.message}</strong><div style="font-size:0.85rem;">위치: ${a.location_text}</div><div style="font-size:0.75rem; opacity:0.7;">${a.full_name}</div></div>
            ${!a.is_resolved && state.user.role==='manager' ? `<button onclick="solveAlert(${a.id})" class="status-badge danger" style="border:none; cursor:pointer;">해결하기</button>` : `<span class="status-badge ${a.is_resolved?'success':'danger'}">${a.is_resolved?'해결됨':'대기중'}</span>`}
        </div>`;
    });
    container.innerHTML = html;
}

function toggleAlertInput() {
    const val = document.getElementById('a-type').value;
    const detail = document.getElementById('a-msg-detail');
    if(val === '기타') detail.classList.remove('hidden');
    else detail.classList.add('hidden');
}

async function postAlert(){
    const type = document.getElementById('a-type').value;
    const detail = document.getElementById('a-msg-detail').value;
    const loc = document.getElementById('a-loc').value;

    let message = type;
    if(type === '기타') {
        if(!detail) return showToast("기타 사유를 입력해주세요", true);
        message = `[기타] ${detail}`;
    }

    if(!loc) return showToast("위치를 입력해주세요", true);

    try {
        await apiFetch('/alerts/emergency','POST',{message: message, location_text: loc});
        showToast("신고 접수됨", true);
        renderView('alerts');
    } catch(e) { showToast(e.message, true); }
}
async function solveAlert(id){ await apiFetch(`/manager/alerts/emergency/${id}/resolve`,'PUT'); renderView('alerts'); }

// [하자 신고]
async function loadIssues(container) {
    let issues = [];
    try {
        issues = state.user.role === 'manager' ? await apiFetch('/manager/issues') : await apiFetch('/issues/me');
        // apiFetch가 null 반환할 수도 있으니 방어
        if (!issues) issues = [];
    } catch (err) {
        console.error("하자 신고 로딩 에러:", err);
        showToast(`하자 신고 로딩 실패: ${err.message}`, true);

        // 에러일 때도 기본 UI 보여주기
        container.innerHTML = `
            <div class="card">
                <div class="floating-input">
                    <input id="i-title" placeholder=" "><label>문제 제목</label>
                </div>
                <button onclick="postIssue()" class="gradient-btn" style="width:auto;">등록</button>
            </div>
            <div class="card">
                <p style="color:#ef4444;">하자 신고를 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.</p>
            </div>
        `;
        return;
    }

    // 정상 흐름
    let html = `<div class="card"><div class="floating-input"><input id="i-title" placeholder=" "><label>문제 제목</label></div><button onclick="postIssue()" class="gradient-btn" style="width:auto;">등록</button></div>`;

    if (!Array.isArray(issues) || issues.length === 0) {
        html += `<div class="empty-state"><p>등록된 하자/문제가 없습니다.</p></div>`;
    } else {
        issues.forEach(i => {
            html += `<div class="list-item issue">
                        <div>
                          <strong>${i.title}</strong>
                          <div style="font-size:0.8rem;">${i.description || ''}</div>
                        </div>
                        <span class="status-badge info">${i.status || ''}</span>
                     </div>`;
        });
    }

    container.innerHTML = html;
}

async function postIssue() {
    const title = document.getElementById('i-title').value || '';
    if (!title.trim()) return showToast("제목을 입력해주세요.", true);

    // 예시: 상세 내용을 입력 UI가 없으니 간단하게 처리 (원하면 상세입력 요소 추가)
    const description = "상세 내용";
    const issue_type = "기타";

    const fd = new FormData();
    fd.append('title', title);
    fd.append('description', description);
    fd.append('issue_type', issue_type);

    // 만약 사진 첨부 input이 있다면:
    // const photo = document.getElementById('i-photo').files[0];
    // if (photo) fd.append('photo', photo);

    try {
        await apiFetch('/issues', 'POST', fd);
        showToast("하자 신고가 등록되었습니다.");
        renderView('issues'); // 목록 갱신
    } catch (e) {
        console.error("하자 등록 실패:", e);
        showToast(e.message || "등록 실패", true);
    }
}

// [도면 관리 - 이미지 미리보기 FIX]
async function loadDrawings(container) {
    async function downloadDrawing(id, filename) {
    try {
        const res = await fetch(`${BASE_URL}/drawings/${id}/file`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });

        if (!res.ok) throw new Error("파일 다운로드 실패");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "drawing";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
        showToast("도면 다운로드 완료!");
    } catch (e) {
        showToast(e.message, true);
    }
}

    let list = await apiFetch('/drawings');
    let html = state.user.role==='manager' ? `<div class="card"><input type="file" id="d-file"><button onclick="upDrawing()" class="gradient-btn">업로드</button></div>` : '';
    html += '<div class="grid-2-sm">';

    list.forEach(d => {
        const isImage = d.content_type && d.content_type.startsWith('image');
        const fileUrl = `${BASE_URL}/drawings/${d.id}/file`;

        // 1. 이미지는 "auth-img" 클래스와 data-src 속성을 가짐 (바로 src에 넣지 않음)
        // 2. 나머지는 기존처럼 PDF 아이콘 표시
        let previewHtml;
        if (isImage) {
            // 초기에는 로딩 아이콘(또는 빈값)을 보여주고, JS가 실제 이미지를 로드함
            previewHtml = `<img data-src="${fileUrl}" class="dwg-preview auth-img" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2NjYyIgZD0iTTEyIDJDMTYuNDIgMiAyMCA1LjU4IDIwIDEwQzIwIDE0LjQyIDE2LjQyIDE4IDEyIDE4QzcuNTggMTggNCAxNC40MiA0IDEwQzQgNS41OCA3LjU4IDIgMTIgMlpNMTIgNEM4LjY5IDQgNiA2LjY5IDYgMTBDNiAxMy4zMSA4LjY5IDE2IDEyIDE2QzE1LjMxIDE2IDE4IDEzLjMxIDE4IDEwQzE4IDYuNjkgMTUuMzEgNCAxMiA0Wk0xMiA2QzE0LjIxIDYgMTYgNy43OSAxNiAxMEMxNiAxMi4yMSAxNC4yMSAxNCAxMiAxNEM5Ljc5IDE0IDggMTIuMjEgOCAxMEM4IDcuNzkgOS43OSA2IDEyIDZaIi8+PC9zdmc+" alt="로딩중...">`;
        } else {
            previewHtml = `<span class="material-icons-round" style="font-size:4rem; color:#6366f1; margin-bottom:10px;">picture_as_pdf</span>`;
        }

        html += `
        <div class="card" style="text-align:center;">
            ${previewHtml}
            <h4 style="margin-bottom:5px;">${d.title}</h4>
            <button class="status-badge info"
                onclick="downloadDrawing(${d.id}, '${d.title}')"
                style="text-decoration:none; cursor:pointer;">
                다운로드
            </button>

            ${state.user.role==='manager'?`<button onclick="delDwg(${d.id})" class="icon-btn" style="display:block; margin:10px auto;">❌ 삭제</button>`:''}
        </div>`;
    });
    html += '</div>';

    container.innerHTML = html;

    // [중요] HTML 렌더링 후, 이미지들을 실제로 로드하는 함수 호출
    loadAuthenticatedImages();
}

// ✅ 출석 CSV(엑셀용) 다운로드
async function downloadAttendanceCsv() {
    try {
        const res = await fetch(`${BASE_URL}/manager/attendance/export-csv`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        if (!res.ok) throw new Error('파일 다운로드에 실패했습니다.');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance.csv';  // 엑셀에서 바로 열 수 있는 CSV
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showToast('출석 엑셀 파일 다운로드 완료');
    } catch (e) {
        showToast(e.message, true);
    }
}

// ✅ 내 정보(개인정보 수정) 화면
async function loadProfile(container) {
    const user = await apiFetch('/me');  // 최신 정보 다시 가져오기

    container.innerHTML = `
        <div class="card">
            <h3><span class="material-icons-round" style="color:#6366f1;">account_circle</span> 내 정보</h3>
            <p style="font-size:0.85rem; color:#64748b; margin-bottom:1rem;">
                아이디, 역할, 소속 현장은 변경할 수 없고, 나머지 정보만 수정할 수 있습니다.
            </p>
            <div class="grid-2-sm">
                <div class="floating-input">
                    <input type="text" id="p-fullname" required placeholder=" " value="${user.full_name || ''}">
                    <label>이름</label>
                </div>
                <div class="floating-input">
                    <input type="text" id="p-username" disabled placeholder=" " value="${user.username}">
                    <label>아이디 (수정 불가)</label>
                </div>
            </div>

            <div class="grid-2-sm">
                <input type="date" id="p-birth" class="simple-input" value="${user.birth_date || ''}">
                <select id="p-gender" class="simple-input">
                    <option value="">성별 선택</option>
                    <option value="남" ${user.gender === '남' ? 'selected' : ''}>남성</option>
                    <option value="여" ${user.gender === '여' ? 'selected' : ''}>여성</option>
                    <option value="기타" ${user.gender === '기타' ? 'selected' : ''}>기타</option>
                </select>
            </div>

            <div class="grid-2-sm">
                <input type="text" id="p-trade" class="simple-input" placeholder="담당 공종" value="${user.trade_type || ''}">
                <input type="text" id="p-phone" class="simple-input" placeholder="연락처" value="${user.phone || ''}">
            </div>

            <div class="grid-2-sm">
                <input type="email" id="p-email" class="simple-input" placeholder="이메일" value="${user.email || ''}">
                <input type="password" id="p-password" class="simple-input" placeholder="비밀번호 변경 (필요 시만 입력)">
            </div>

            <div style="margin-top:1rem; display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="renderView('dashboard')" class="icon-btn" style="padding:10px 16px;">취소</button>
                <button onclick="saveProfile()" class="gradient-btn" style="width:auto;">저장하기</button>
            </div>
        </div>
    `;
}
// ✅ 개인정보 저장
async function saveProfile() {
    const body = {
        full_name: document.getElementById('p-fullname').value,
        birth_date: document.getElementById('p-birth').value || null,
        gender: document.getElementById('p-gender').value || null,
        trade_type: document.getElementById('p-trade').value || null,
        phone: document.getElementById('p-phone').value || null,
        email: document.getElementById('p-email').value || null,
        password: document.getElementById('p-password').value || null,
    };

    // 빈 문자열은 보내지 않도록 정리 (None만 보내서 "변경 없음" 처리)
    Object.keys(body).forEach(k => {
        if (body[k] === '' || body[k] === null) {
            delete body[k];
        }
    });

    try {
        const updated = await apiFetch('/me', 'PUT', body);  // 백엔드 UpdateUser 사용 :contentReference[oaicite:10]{index=10}
        state.user = updated;

        // 헤더 프로필도 최신 정보로 갱신
        document.getElementById('user-avatar').innerText = updated.full_name[0];
        document.getElementById('nav-username').innerText = updated.full_name;

        showToast('개인정보가 수정되었습니다.');
        renderView('dashboard');
    } catch (e) {
        showToast(e.message, true);
    }
}
// ✅ 관리자: 아이디로 근로자 검색
async function searchWorkerById() {
    const input = document.getElementById('w-search-username');
    const username = input.value.trim();
    if (!username) {
        showToast('검색할 아이디를 입력해주세요.', true);
        return;
    }

    try {
        const user = await apiFetch(`/manager/users/${username}`);  // 백엔드 검색 API

        // 테이블에서 해당 행 하이라이트
        const rows = document.querySelectorAll('#workers-table-body tr');
        rows.forEach(r => r.style.background = '');

        const target = document.querySelector(`#workers-table-body tr[data-username="${user.username}"]`);
        if (target) {
            target.style.background = 'rgba(250, 250, 200, 0.9)';
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast(`"${user.username}" 사용자를 찾았습니다.`);
        } else {
            showToast('해당 아이디를 목록에서 찾을 수 없습니다.', true);
        }
    } catch (e) {
        showToast('해당 아이디를 찾을 수 없습니다.', true);
    }
}

// ** 인증된 이미지 로더 함수 **
// 일반 <img src>는 헤더를 못 보내서 401 에러가 남 -> fetch로 가져와서 blob으로 변환
async function loadAuthenticatedImages() {
    const images = document.querySelectorAll('.auth-img');
    for (let img of images) {
        try {
            const res = await fetch(img.dataset.src, {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            img.src = URL.createObjectURL(blob);
        } catch (e) {
            // 로드 실패 시
            img.parentElement.innerHTML = '<div style="height:200px; display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#ef4444;">이미지 로드 실패</div>';
        }
    }
}

async function upDrawing(){
    let f = document.getElementById('d-file').files[0]; if(!f) return;
    let fd = new FormData(); fd.append("title", f.name); fd.append("file", f);
    await fetch(`${BASE_URL}/manager/drawings`, {method:'POST',headers:{'Authorization':`Bearer ${state.token}`},body:fd}); renderView('drawings');
}
async function delDwg(id){ if(confirm('삭제?')) { await apiFetch(`/manager/drawings/${id}`,'DELETE'); renderView('drawings'); } }

// [공정 관리]
async function loadProcesses(container) {
    let list = await apiFetch('/processes');
    let html = `<div class="card"><div class="grid-2-sm"><input id="p-loc" class="simple-input" placeholder="위치"><input id="p-work" class="simple-input" placeholder="작업명"></div><button onclick="postProc()" class="gradient-btn">일정 추가</button></div>`;
    html += '<div class="card"><table><tr style="color:#666;"><th>날짜</th><th>위치</th><th>작업</th><th>상태</th></tr>';
    list.forEach(p => { html += `<tr><td>${p.start_date||'-'}</td><td>${p.location}</td><td>${p.work_name}</td><td><span class="status-badge info">${p.status}</span></td></tr>`; });
    html += '</table></div>';
    container.innerHTML = html;
}
async function postProc(){ await apiFetch('/processes','POST',{location:document.getElementById('p-loc').value, work_name:document.getElementById('p-work').value}); renderView('processes'); }

// [관리자 전용: 근로자 명단]
async function loadWorkers(container) {
    if (state.user.role !== 'manager') {
        container.innerHTML = '<div class="card">관리자 권한이 필요합니다.</div>';
        return;
    }
    const users = await apiFetch('/manager/users');
    const workers = users.filter(u => u.role === 'worker');

    let html = `<div class="card">
        <h3><span class="material-icons-round">groups</span> 현장 근로자 명단 (${workers.length}명)</h3>

        <!-- 검색 영역 -->
        <div style="display:flex; gap:10px; align-items:center; margin:10px 0 15px 0;">
            <input id="w-search-username" class="simple-input" placeholder="아이디(username)로 검색">
            <button onclick="searchWorkerById()" class="gradient-btn"
                style="padding:8px 16px; font-size:0.9rem; width:auto;">
                검색
            </button>
        </div>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>아이디</th>
                        <th>공종</th>
                        <th>전화번호</th>
                        <th>생년월일</th>
                    </tr>
                </thead>
                <tbody id="workers-table-body">`;

    workers.forEach(w => {
        html += `
            <tr data-username="${w.username}">
                <td style="font-weight:bold;">${w.full_name || w.username}</td>
                <td>${w.username}</td>
                <td><span class="status-badge info">${w.trade_type || '-'}</span></td>
                <td>${w.phone || '-'}</td>
                <td>${w.birth_date || '-'}</td>
            </tr>`;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
}



// [유틸리티]
// 기존 apiFetch 대체 — FormData 처리, 상세 에러 로깅 추가
async function apiFetch(ep, m='GET', b=null) {
    let opts = { method: m, headers: { 'Authorization': `Bearer ${state.token}` } };

    // b가 FormData면 Content-Type 헤더를 직접 설정하지 말 것
    if (b) {
        if (b instanceof FormData) {
            opts.body = b;
            // don't set Content-Type — browser will add multipart/form-data boundary
        } else {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(b);
        }
    }

    const url = `${BASE_URL}${ep}`;
    let res;
    try {
        res = await fetch(url, opts);
    } catch (networkErr) {
        console.error("네트워크/Fetch 에러:", networkErr, url, opts);
        throw new Error("네트워크 오류가 발생했습니다.");
    }

    if (!res.ok) {
        // 가능한 상세 에러 메시지 추출
        let errDetail = `HTTP ${res.status}`;
        try {
            const errJson = await res.json();
            // FastAPI 에러는 보통 {detail: "..."} 형태
            if (errJson && errJson.detail) errDetail = errJson.detail;
            else errDetail = JSON.stringify(errJson);
        } catch (parseErr) {
            // JSON 파싱 실패하면 텍스트로 시도
            try {
                const text = await res.text();
                if (text) errDetail = text;
            } catch (e) {}
        }
        console.error("API 에러:", url, res.status, errDetail);
        throw new Error(errDetail || "요청 실패");
    }

    // 정상 응답인데 body가 비어있을 수 있음 (204 등) -> 빈 배열/객체로 처리
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
}
function showToast(msg, err=false) {
    let t = document.createElement('div'); t.className = `toast ${err?'error':''}`;
    t.innerHTML = `<span class="material-icons-round">${err?'error':'check_circle'}</span> ${msg}`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(()=>t.remove(), 3000);
}
function formatTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}
async function downloadDrawing(id, filename) {
    try {
        const res = await fetch(`${BASE_URL}/drawings/${id}/file`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });

        if (!res.ok) throw new Error("파일 다운로드 실패");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename || "drawing";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
        showToast("도면 다운로드 완료!");
    } catch (e) {
        showToast(e.message, true);
    }
}
