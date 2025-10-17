// 生徒用サイトのJavaScript

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    loadCafeteriaStatus();
    
    // データ更新イベントをリッスン
    window.addEventListener('dataUpdated', function(event) {
        loadCafeteriaStatus();
    });
});

// 食堂の営業状況を読み込む
async function loadCafeteriaStatus() {
    try {
        // まずローカルストレージからデータを取得
        let data = JSON.parse(localStorage.getItem('cafeteriaData') || 'null');
        
        // ローカルストレージにデータがない場合は、data.jsonから読み込み
        if (!data) {
            const response = await fetch('data.json');
            data = await response.json();
        }
        
        const statusDisplay = document.getElementById('status-display');
        const today = new Date().toISOString().split('T')[0];
        const dayOfWeek = new Date().getDay();
        
        // 今日が休業日かチェック
        const isHoliday = data.holidays.some(holiday => holiday.date === today);
        
        if (isHoliday) {
            const holiday = data.holidays.find(h => h.date === today);
            statusDisplay.innerHTML = `
                <div class="status-holiday">
                    <h3>❌ 本日は休業日です</h3>
                    <p>理由: ${holiday.reason}</p>
                </div>
            `;
        } else if (dayOfWeek === 0) { // 日曜日
            statusDisplay.innerHTML = `
                <div class="status-closed">
                    <h3>❌ 本日は休業日です</h3>
                    <p>日曜日は休業です</p>
                </div>
            `;
        } else {
            const currentTime = new Date();
            const currentHour = currentTime.getHours();
            const currentMinute = currentTime.getMinutes();
            const currentTimeMinutes = currentHour * 60 + currentMinute;
            
            let isOpen = false;
            let nextOpenTime = '';
            
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // 平日
                const openTime = 11 * 60; // 11:00
                const closeTime = 14 * 60; // 14:00
                
                if (currentTimeMinutes >= openTime && currentTimeMinutes <= closeTime) {
                    isOpen = true;
                } else if (currentTimeMinutes < openTime) {
                    nextOpenTime = '11:00';
                }
            } else if (dayOfWeek === 6) { // 土曜日
                const openTime = 11 * 60; // 11:00
                const closeTime = 13 * 60; // 13:00
                
                if (currentTimeMinutes >= openTime && currentTimeMinutes <= closeTime) {
                    isOpen = true;
                } else if (currentTimeMinutes < openTime) {
                    nextOpenTime = '11:00';
                }
            }
            
            if (isOpen) {
                statusDisplay.innerHTML = `
                    <div class="status-open">
                        <h3>✅ 現在営業中です</h3>
                        <p>営業時間: ${dayOfWeek === 6 ? '11:00 - 13:00' : '11:00 - 14:00'}</p>
                    </div>
                `;
            } else {
                statusDisplay.innerHTML = `
                    <div class="status-closed">
                        <h3>❌ 現在休業中です</h3>
                        <p>${nextOpenTime ? `次回営業: ${nextOpenTime}` : '明日の営業をお待ちください'}</p>
                    </div>
                `;
            }
        }
        
        // 今後の休業日を表示
        const upcomingHolidays = data.holidays
            .filter(holiday => holiday.date > today)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 3);
        
        if (upcomingHolidays.length > 0) {
            const holidaysHtml = upcomingHolidays.map(holiday => {
                const date = new Date(holiday.date);
                const formattedDate = date.toLocaleDateString('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                });
                return `<li>${formattedDate}: ${holiday.reason}</li>`;
            }).join('');
            
            statusDisplay.innerHTML += `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    <h4>📅 今後の休業日</h4>
                    <ul style="margin-top: 10px; padding-left: 20px;">
                        ${holidaysHtml}
                    </ul>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        document.getElementById('status-display').innerHTML = `
            <div class="status-closed">
                <h3>❌ 情報を読み込めませんでした</h3>
                <p>しばらくしてから再度お試しください</p>
            </div>
        `;
    }
}

// 定期的にステータスを更新（5分ごと）
setInterval(loadCafeteriaStatus, 5 * 60 * 1000);
