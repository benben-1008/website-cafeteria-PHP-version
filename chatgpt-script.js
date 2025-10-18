// ChatGPT用のJavaScript - OpenAI API統合版

let chatHistory = [];
let chatgptSettings = null;

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    
    // 設定を読み込み
    loadChatGPTSettings();
    
    // Enterキーで送信
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // ボタンクリックで送信
    sendBtn.addEventListener('click', sendMessage);
});

// ChatGPT設定を読み込み
async function loadChatGPTSettings() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        chatgptSettings = data.chatgptSettings;
        
        // APIキーが設定されていない場合の警告
        if (!chatgptSettings.apiKey || chatgptSettings.apiKey === 'YOUR_OPENAI_API_KEY_HERE') {
            addMessageToChat('⚠️ ChatGPT APIキーが設定されていません。管理者にお問い合わせください。', 'bot');
        }
    } catch (error) {
        console.error('設定の読み込みに失敗しました:', error);
        addMessageToChat('設定の読み込みに失敗しました。', 'bot');
    }
}

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
    
    // メッセージを整形して表示
    if (message.includes('\n')) {
        contentDiv.innerHTML = message.replace(/\n/g, '<br>');
    } else {
        contentDiv.textContent = message;
    }
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    // チャットを最下部にスクロール
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // チャット履歴に追加
    chatHistory.push({ message, sender, timestamp: new Date() });
}

// AIのレスポンスを取得
async function getChatGPTResponse(userMessage) {
    try {
        // 定食設定とメニュー情報を取得
        const [dailyMenusResponse, menuResponse] = await Promise.all([
            fetch('api/daily-menu.php').catch(() => null),
            fetch('api/menu.php').catch(() => null)
        ]);
        
        const dailyMenus = dailyMenusResponse ? await dailyMenusResponse.json() : [];
        const menus = menuResponse ? await menuResponse.json() : [];
        
        // コンテキスト情報を構築
        const context = buildContext(dailyMenus, menus);
        
        // 設定されたAPIタイプに応じて呼び出し
        if (chatgptSettings && chatgptSettings.apiType === 'ollama') {
            const response = await callOllamaAPI(userMessage, context);
            return response;
        } else if (chatgptSettings && chatgptSettings.apiKey && chatgptSettings.apiKey !== 'YOUR_OPENAI_API_KEY_HERE') {
            // OpenAI APIを呼び出し
            const response = await callOpenAIAPI(userMessage, context);
            return response;
        } else {
            // 基本的な応答を返す
            return await generateBasicResponse(userMessage);
        }
        
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        return await generateBasicResponse(userMessage);
    }
}

// コンテキスト情報を構築
function buildContext(dailyMenus, menus) {
    const today = new Date().toISOString().split('T')[0];
    const todayMenu = dailyMenus.find(m => m.date === today);
    
    let context = `学校食堂の情報：
営業時間: 平日（月〜金）11:30-13:00、土日休業
場所: 1号館1階、学生ホール隣接
支払い: 現金、学食カード（学生のみ）

`;

    if (todayMenu) {
        context += `今日の定食: ${todayMenu.food}\n\n`;
    }
    
    context += `通常メニュー:\n`;
    if (menus && menus.length > 0) {
        menus.forEach(menu => {
            const stockText = menu.stock > 0 ? `（残り${menu.stock}食）` : '（売り切れ）';
            context += `・${menu.name} ${stockText}\n`;
        });
    } else {
        context += `・日替わり定食（550円）
・日替わり丼（450円）
・カレーライス（450円）
・カツカレー（500円）
・醤油ラーメン（450円）
・かけうどん（350円）\n`;
    }
    
    context += `
アレルギー対応: 卵、乳、小麦、えび、かに、そば、落花生
予約: オンラインで可能（営業時間内のみ）`;
    
    return context;
}

// Ollama APIを呼び出し
async function callOllamaAPI(userMessage, context) {
    const systemPrompt = `${chatgptSettings.systemPrompt}\n\n${context}`;
    
    // チャット履歴を含むメッセージを構築
    const conversationHistory = chatHistory.slice(-10).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.message
    }));
    
    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        ...conversationHistory,
        {
            role: "user",
            content: userMessage
        }
    ];
    
    try {
        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: chatgptSettings.model || 'llama2',
                messages: messages,
                stream: false,
                options: {
                    temperature: chatgptSettings.temperature || 0.7,
                    num_predict: chatgptSettings.maxTokens || 1000
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama API Error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.message.content;
        
    } catch (error) {
        console.error('Ollama API呼び出しエラー:', error);
        // Ollamaが起動していない場合は基本的な応答を返す
        if (error.message.includes('fetch')) {
            throw new Error('Ollamaが起動していません。Ollamaを起動してから再度お試しください。');
        }
        throw error;
    }
}

// OpenAI APIを呼び出し
async function callOpenAIAPI(userMessage, context) {
    const messages = [
        {
            role: "system",
            content: `${chatgptSettings.systemPrompt}\n\n${context}`
        },
        ...chatHistory.slice(-10).map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.message
        })),
        {
            role: "user",
            content: userMessage
        }
    ];
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${chatgptSettings.apiKey}`
        },
        body: JSON.stringify({
            model: chatgptSettings.model || 'gpt-4o',
            messages: messages,
            max_tokens: chatgptSettings.maxTokens || 1000,
            temperature: chatgptSettings.temperature || 0.7
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

// 基本的な応答を生成（APIキーが設定されていない場合）
async function generateBasicResponse(userMessage) {
    const message = userMessage.toLowerCase();
    
    // 今日の定食を取得
    const today = new Date().toISOString().split('T')[0];
    let todayMenu = null;
    
    try {
        const dailyMenusResponse = await fetch('api/daily-menu.php');
        if (dailyMenusResponse.ok) {
            const dailyMenus = await dailyMenusResponse.json();
            todayMenu = dailyMenus.find(m => m.date === today);
        }
    } catch (error) {
        console.error('定食情報の取得に失敗:', error);
    }
    
    // メニューに関する質問
    if (message.includes('メニュー') || message.includes('料理') || message.includes('食べ物') || message.includes('今日')) {
        let response = `今日のメニューは以下の通りです：\n\n`;
        
        if (todayMenu) {
            response += `🍽️ **今日の定食**\n・${todayMenu.food}\n\n`;
        }
        
        response += `🍽️ **通常メニュー**\n`;
        response += `・日替わり定食（550円）\n・日替わり丼（450円）\n・カレーライス（450円）\n・カツカレー（500円）\n・醤油ラーメン（450円）\n・かけうどん（350円）\n`;
        
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
・アレルギーに関するご質問は食堂スタッフまでお声がけください`;
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