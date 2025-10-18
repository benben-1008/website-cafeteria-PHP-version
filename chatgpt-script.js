// ChatGPT用のJavaScript

let chatHistory = [];

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    // Enterキーで送信
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // ボタンクリックで送信
    sendBtn.addEventListener('click', sendMessage);
});

// メッセージを送信
async function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) {
        return;
    }
    
    // ユーザーメッセージを表示
    addMessageToChat(message, 'user');
    
    // 入力欄をクリア
    chatInput.value = '';
    
    // 送信ボタンを無効化
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = '送信中...';
    
    try {
        // レスポンスを取得
        const response = await getChatGPTResponse(message);
        addMessageToChat(response, 'bot');
    } catch (error) {
        console.error('エラーが発生しました:', error);
        addMessageToChat('申し訳ございません。エラーが発生しました。しばらくしてから再度お試しください。', 'bot');
    } finally {
        // 送信ボタンを有効化
        sendBtn.disabled = false;
        sendBtn.textContent = '送信';
    }
}

// チャットにメッセージを追加
function addMessageToChat(message, sender) {
    const chatContainer = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // チャットを最下部にスクロール
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // チャット履歴に追加
    chatHistory.push({ message, sender, timestamp: new Date() });
}

// ChatGPTのレスポンスを取得
async function getChatGPTResponse(userMessage) {
    try {
        // 定食設定とメニュー情報を取得
        const [dailyMenusResponse, menuResponse] = await Promise.all([
            fetch('api/daily-menu.php').catch(() => null),
            fetch('api/menu.php').catch(() => null)
        ]);
        
        const dailyMenus = dailyMenusResponse ? await dailyMenusResponse.json() : [];
        const menus = menuResponse ? await menuResponse.json() : [];
        
        // 基本的な応答を生成
        return generateBasicResponse(userMessage, dailyMenus, menus);
        
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        return generateBasicResponse(userMessage, [], []);
    }
}

// 基本的な応答を生成
function generateBasicResponse(userMessage, dailyMenus, menus) {
    const message = userMessage.toLowerCase();
    
    // 今日の定食を取得
    const today = new Date().toISOString().split('T')[0];
    const todayMenu = dailyMenus.find(m => m.date === today);
    
    // メニューに関する質問
    if (message.includes('メニュー') || message.includes('料理') || message.includes('食べ物') || message.includes('今日')) {
        let response = `今日のメニューは以下の通りです：\n\n`;
        
        if (todayMenu) {
            response += `🍽️ **今日の定食**\n・${todayMenu.food}\n\n`;
        }
        
        response += `🍽️ **通常メニュー**\n`;
        if (menus && menus.length > 0) {
            menus.forEach(menu => {
                const stockText = menu.stock > 0 ? `（残り${menu.stock}食）` : '（売り切れ）';
                response += `・${menu.name} ${stockText}\n`;
            });
        } else {
            response += `・日替わり定食（550円）\n・日替わり丼（450円）\n・カレーライス（450円）\n・カツカレー（500円）\n・醤油ラーメン（450円）\n・かけうどん（350円）\n`;
        }
        
        response += `\n※メニューは日によって変更する場合があります。`;
        return response;
    }
    
    // 営業時間に関する質問
    if (message.includes('営業時間') || message.includes('時間') || message.includes('いつ')) {
        return `食堂の営業時間は以下の通りです：

📅 **営業時間**
・平日（月〜金）: 昼休憩時間（11:30 - 13:00）
・土曜日・日曜日: 休業日

※営業時間は変更する場合があります。最新情報はメインページでご確認ください。`;
    }
    
    // 予約に関する質問
    if (message.includes('予約') || message.includes('予約する')) {
        return `食堂の予約について：

📝 **予約方法**
・予約サイトからオンラインで予約できます
・名前とメニュー（定食・焼き飯）を選択してください

⏰ **予約可能時間**
・営業時間内（平日11:30-13:00）
・土日は休業日のため予約不可

※予約サイトはメインページからアクセスできます。`;
    }
    
    // アレルギーに関する質問
    if (message.includes('アレルギー') || message.includes('アレルゲン')) {
        return `アレルギー対応について：

⚠️ **アレルギー対応**
・卵、乳、小麦、えび、かに、そば、落花生のアレルギー対応を行っています
・予約時にアレルギー情報をお知らせください
・詳細な原材料については食堂スタッフにお尋ねください

📞 **お問い合わせ**
・アレルギーに関するご質問は食堂スタッフまでお声がけください
・電話: 03-1234-5678`;
    }
    
    // 価格に関する質問
    if (message.includes('値段') || message.includes('価格') || message.includes('料金')) {
        return `料金について：

💰 **料金表**
・日替わり定食: 550円
・日替わり丼: 450円
・カレーライス: 450円
・カツカレー: 500円
・醤油ラーメン: 450円
・かけうどん: 350円

💳 **支払い方法**
・現金
・学食カード（学生のみ）

※価格は税込です。`;
    }
    
    // 場所に関する質問
    if (message.includes('場所') || message.includes('どこ') || message.includes('位置')) {
        return `食堂の場所について：

📍 **所在地**
・1号館 1階
・学生ホール隣接

🚶 **アクセス**
・正門から徒歩3分
・駐車場から徒歩5分

📱 **地図**
・学内マップで「学生食堂」で検索できます
・案内板に従ってお越しください`;
    }
    
    // その他の質問
    return `ご質問ありがとうございます！

食堂について何かお聞きになりたいことがございましたら、以下のような内容についてお答えできます：

🍽️ メニューについて
⏰ 営業時間について  
📝 予約について
⚠️ アレルギー対応について
💰 料金について
📍 場所について

具体的なご質問をお聞かせください。`;
}

// クイック質問ボタン用
function askQuestion(question) {
    const chatInput = document.getElementById('chat-input');
    chatInput.value = question;
    sendMessage();
}
