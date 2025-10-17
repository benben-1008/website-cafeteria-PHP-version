// 予約システムのJavaScript

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    // 特に何もしない（メニューは固定）
});

// フォーム送信処理
document.getElementById('reservation-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('student-name').value,
        food: document.getElementById('food').value
    };
    
    // バリデーション
    if (!validateForm(formData)) {
        return;
    }
    
    try {
        submitReservation(formData);
        alert('予約が完了しました！');
        resetForm();
    } catch (error) {
        console.error('予約の送信に失敗しました:', error);
        alert('予約の送信に失敗しました。しばらくしてから再度お試しください。');
    }
});

// フォームバリデーション
function validateForm(data) {
    if (!data.name.trim()) {
        alert('お名前を入力してください。');
        return false;
    }
    
    if (!data.food) {
        alert('メニューを選択してください。');
        return false;
    }
    
    return true;
}

// 予約を送信
function submitReservation(formData) {
    const reservation = {
        id: Date.now(), // 簡単なID生成
        name: formData.name,
        food: formData.food,
        status: 'confirmed',
        createdAt: new Date().toISOString()
    };
    
    // ローカルストレージに保存
    const existingReservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    existingReservations.push(reservation);
    localStorage.setItem('reservations', JSON.stringify(existingReservations));
    
    console.log('予約が送信されました:', reservation);
}

// フォームをリセット
function resetForm() {
    document.getElementById('reservation-form').reset();
}
