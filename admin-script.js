// 管理用サイトのJavaScript

let data = null;

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

// データを読み込む
async function loadData() {
    try {
        const response = await fetch('data.json');
        data = await response.json();
        
        loadHolidays();
        loadChatGPTSettings();
        loadReservations();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        alert('データの読み込みに失敗しました。');
    }
}

// 休業日一覧を表示
function loadHolidays() {
    const holidaysList = document.getElementById('holidays-list');
    
    if (data.holidays.length === 0) {
        holidaysList.innerHTML = '<p>休業日は設定されていません。</p>';
        return;
    }
    
    const holidaysHtml = data.holidays
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(holiday => {
            const date = new Date(holiday.date);
            const formattedDate = date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
            
            return `
                <div class="holiday-item">
                    <div class="holiday-info">
                        <div class="holiday-date">${formattedDate}</div>
                        <div class="holiday-reason">${holiday.reason}</div>
                    </div>
                    <button class="delete-btn" onclick="deleteHoliday('${holiday.date}')">削除</button>
                </div>
            `;
        }).join('');
    
    holidaysList.innerHTML = holidaysHtml;
}

// 休業日を追加
async function addHoliday() {
    const dateInput = document.getElementById('holiday-date');
    const reasonInput = document.getElementById('holiday-reason');
    
    if (!dateInput.value || !reasonInput.value) {
        alert('日付と理由を入力してください。');
        return;
    }
    
    const newHoliday = {
        date: dateInput.value,
        reason: reasonInput.value
    };
    
    // 既に同じ日付の休業日があるかチェック
    if (data.holidays.some(holiday => holiday.date === newHoliday.date)) {
        alert('この日付の休業日は既に設定されています。');
        return;
    }
    
    data.holidays.push(newHoliday);
    
    try {
        await saveData();
        loadHolidays();
        
        // フォームをリセット
        dateInput.value = '';
        reasonInput.value = '';
        
        alert('休業日を追加しました。');
    } catch (error) {
        console.error('保存に失敗しました:', error);
        alert('保存に失敗しました。');
    }
}

// 休業日を削除
async function deleteHoliday(date) {
    if (!confirm('この休業日を削除しますか？')) {
        return;
    }
    
    data.holidays = data.holidays.filter(holiday => holiday.date !== date);
    
    try {
        await saveData();
        loadHolidays();
        alert('休業日を削除しました。');
    } catch (error) {
        console.error('削除に失敗しました:', error);
        alert('削除に失敗しました。');
    }
}

// ChatGPT設定を読み込む
function loadChatGPTSettings() {
    const promptTextarea = document.getElementById('chatgpt-prompt');
    const apiKeyInput = document.getElementById('chatgpt-api-key');
    
    promptTextarea.value = data.chatgptSettings.systemPrompt || '';
    apiKeyInput.value = data.chatgptSettings.apiKey || '';
}

// ChatGPT設定を保存
async function saveChatGPTSettings() {
    const promptTextarea = document.getElementById('chatgpt-prompt');
    const apiKeyInput = document.getElementById('chatgpt-api-key');
    
    data.chatgptSettings.systemPrompt = promptTextarea.value;
    data.chatgptSettings.apiKey = apiKeyInput.value;
    
    try {
        await saveData();
        alert('ChatGPT設定を保存しました。');
    } catch (error) {
        console.error('保存に失敗しました:', error);
        alert('保存に失敗しました。');
    }
}

// 予約一覧を表示
function loadReservations() {
    const reservationsList = document.getElementById('reservations-list');
    const today = new Date().toISOString().split('T')[0];
    
    // ローカルストレージからも予約を取得
    const localReservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    const allReservations = [...data.reservations, ...localReservations];
    
    const todayReservations = allReservations.filter(reservation => reservation.date === today);
    
    if (todayReservations.length === 0) {
        reservationsList.innerHTML = '<p>今日の予約はありません。</p>';
        return;
    }
    
    const reservationsHtml = todayReservations
        .sort((a, b) => a.time.localeCompare(b.time))
        .map(reservation => `
            <div class="reservation-item">
                <div class="reservation-time">${reservation.time}</div>
                <div class="reservation-details">
                    <strong>${reservation.name}</strong> (${reservation.people}名)<br>
                    <span class="food-item">🍽️ ${reservation.food || 'メニュー未選択'}</span><br>
                    <small>電話: ${reservation.phone}</small>
                    ${reservation.notes ? `<br><small>備考: ${reservation.notes}</small>` : ''}
                </div>
            </div>
        `).join('');
    
    reservationsList.innerHTML = reservationsHtml;
}

// 予約一覧を更新
function refreshReservations() {
    loadReservations();
}

// データを保存
async function saveData() {
    // ローカルストレージに保存
    localStorage.setItem('cafeteriaData', JSON.stringify(data));
    
    // 実際の実装では、サーバーにデータを送信する必要があります
    // ここではローカルストレージに保存する例を示します
    
    // サーバーに送信する場合の例（実際の実装では適切なエンドポイントを使用）
    /*
    const response = await fetch('/api/save-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error('保存に失敗しました');
    }
    */
    
    // データが更新されたことを他のページに通知
    window.dispatchEvent(new CustomEvent('dataUpdated', { detail: data }));
}
