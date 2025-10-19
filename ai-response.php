<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// リクエストボディを取得
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['message'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Message is required']);
    exit;
}

$userMessage = $input['message'];
$useOllama = isset($input['useOllama']) ? $input['useOllama'] : true;

// Ollamaが利用可能かチェック
$ollamaAvailable = checkOllamaAvailability();

$response = generateAIResponse($userMessage, $useOllama, $ollamaAvailable);

echo json_encode([
    'response' => $response,
    'ollamaUsed' => $ollamaAvailable && $useOllama,
    'ollamaAvailable' => $ollamaAvailable,
    'apiType' => $ollamaAvailable && $useOllama ? 'Ollama' : 'Basic'
]);

// Ollamaの可用性をチェック
function checkOllamaAvailability() {
    // 本番環境ではクラウドOllamaサービスを使用
    if (isProductionEnvironment()) {
        return checkCloudOllamaAvailability();
    }
    
    // ローカル環境ではlocalhostのOllamaをチェック
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'http://localhost:11434/api/tags');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    // エラーが発生した場合は利用不可
    if ($error) {
        error_log("Ollama connection error: " . $error);
        return false;
    }
    
    return $httpCode === 200;
}

// クラウドOllamaサービスの可用性をチェック
function checkCloudOllamaAvailability() {
    // 無料のOllama APIサービスをチェック
    $cloudServices = [
        'https://ollama.ai/api/tags',  // 公式API（例）
        'https://api.ollama.ai/v1/models'  // 代替API（例）
    ];
    
    foreach ($cloudServices as $url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'User-Agent: Mozilla/5.0 (compatible; AI-Assistant/1.0)'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if (!$error && $httpCode === 200) {
            return true;
        }
    }
    
    return false;
}

// 本番環境かどうかを判定
function isProductionEnvironment() {
    // InfinityFreeやその他の本番環境の判定
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $isLocalhost = strpos($host, 'localhost') !== false || 
                   strpos($host, '127.0.0.1') !== false ||
                   strpos($host, '::1') !== false;
    
    return !$isLocalhost;
}

// Ollama APIを呼び出し
function callOllamaAPI($userMessage) {
    $systemPrompt = "あなたは学校食堂のAIアシスタントです。メニュー、営業時間、予約について質問に答えてください。親切で丁寧な対応を心がけてください。また、一般的な質問にも答えることができます。";
    
    if (isProductionEnvironment()) {
        // 本番環境ではクラウドOllamaサービスを使用
        return callCloudOllamaAPI($userMessage, $systemPrompt);
    } else {
        // ローカル環境ではlocalhostのOllamaを使用
        return callLocalOllamaAPI($userMessage, $systemPrompt);
    }
}

// ローカルOllama APIを呼び出し
function callLocalOllamaAPI($userMessage, $systemPrompt) {
    $requestBody = [
        'model' => 'llama2',
        'messages' => [
            [
                'role' => 'system',
                'content' => $systemPrompt
            ],
            [
                'role' => 'user',
                'content' => $userMessage
            ]
        ],
        'stream' => false
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'http://localhost:11434/api/chat');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestBody));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    // エラーログを記録
    if ($error) {
        error_log("Local Ollama API error: " . $error);
        return false;
    }
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (isset($data['message']['content'])) {
            return $data['message']['content'];
        }
    }
    
    error_log("Local Ollama API failed with HTTP code: " . $httpCode);
    return false;
}

// クラウドOllama APIを呼び出し
function callCloudOllamaAPI($userMessage, $systemPrompt) {
    // 無料のAI APIサービスを使用（例：Hugging Face、OpenAI等）
    $cloudServices = [
        'huggingface' => 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        'openai' => 'https://api.openai.com/v1/chat/completions'
    ];
    
    // Hugging Face APIを試行（無料、APIキー不要）
    $hfResponse = callHuggingFaceAPI($userMessage, $systemPrompt);
    if ($hfResponse !== false) {
        return $hfResponse;
    }
    
    // その他のサービスも試行可能
    return false;
}

// Hugging Face APIを呼び出し
function callHuggingFaceAPI($userMessage, $systemPrompt) {
    $prompt = $systemPrompt . "\n\n質問: " . $userMessage . "\n回答:";
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'inputs' => $prompt,
        'parameters' => [
            'max_length' => 200,
            'temperature' => 0.7,
            'do_sample' => true,
            'pad_token_id' => 50256
        ]
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0 (compatible; AI-Assistant/1.0)'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        error_log("Hugging Face API error: " . $error);
        return false;
    }
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if (isset($data[0]['generated_text'])) {
            $generatedText = $data[0]['generated_text'];
            // プロンプト部分を除去して回答のみを抽出
            $answer = str_replace($prompt, '', $generatedText);
            return trim($answer) ?: '申し訳ございません。適切な回答を生成できませんでした。';
        }
    }
    
    error_log("Hugging Face API failed with HTTP code: " . $httpCode);
    return false;
}

function generateAIResponse($userMessage, $useOllama = true, $ollamaAvailable = false) {
    // Ollamaが利用可能で使用する場合
    if ($ollamaAvailable && $useOllama) {
        $ollamaResponse = callOllamaAPI($userMessage);
        if ($ollamaResponse !== false) {
            return $ollamaResponse;
        }
    }
    
    $message = strtolower($userMessage);

    // 天気に関する質問
    if (strpos($message, '天気') !== false || strpos($message, 'weather') !== false) {
        return "申し訳ございませんが、天気予報については食堂のAIアシスタントではお答えできません。

食堂について以下の内容でしたらお答えできます：

🍽️ メニューについて
⏰ 営業時間について  
📝 予約について
⚠️ アレルギー対応について
💰 料金について
📍 場所について

食堂に関するご質問をお聞かせください。";
    }

    // 時間に関する質問
    if (strpos($message, '今何時') !== false || strpos($message, '時間') !== false || strpos($message, '時刻') !== false) {
        $now = new DateTime();
        $timeString = $now->format('H:i');
        $isOpen = ($now->format('H') >= 11 && $now->format('H') < 13);
        
        return "現在の時刻は{$timeString}です。

食堂の営業時間は平日11:30-13:00ですので、" . ($isOpen ? '現在営業中です' : '現在は営業時間外です') . "。

他にご質問がございましたらお聞かせください。";
    }

    // 日付に関する質問
    if (strpos($message, '今日') !== false || strpos($message, '何日') !== false || strpos($message, '日付') !== false) {
        $today = new DateTime();
        $dateString = $today->format('Y年n月j日') . '（' . ['日', '月', '火', '水', '木', '金', '土'][$today->format('w')] . '）';
        
        return "今日は{$dateString}です。

食堂は平日（月〜金）11:30-13:00に営業しています。

他にご質問がございましたらお聞かせください。";
    }

    // メニューに関する質問
    if (strpos($message, 'メニュー') !== false || strpos($message, '料理') !== false || strpos($message, '食べ物') !== false) {
        return "今日のメニューは以下の通りです：

🍽️ **今日の定食**

🍛 **日替わり定食** - 550円
・主菜：とんかつ
・副菜：サラダ、味噌汁
・ご飯、漬物

🍜 **麺類**
・醤油ラーメン - 450円
・かけうどん - 350円

🍚 **丼物**
・親子丼 - 400円
・カツ丼 - 450円

🥤 **飲み物**
・コーヒー - 100円
・紅茶 - 100円
・ジュース - 120円

**営業時間：** 平日 11:30-13:00
**支払い方法：** 現金、学食カード

他にご質問がございましたらお聞かせください。";
    }

    // 営業時間に関する質問
    if (strpos($message, '営業時間') !== false || strpos($message, '何時') !== false || strpos($message, '開いて') !== false || strpos($message, '閉まって') !== false) {
        $now = new DateTime();
        $timeString = $now->format('H:i');
        
        return "営業時間についてお答えします。

⏰ **営業時間**

**平日（月〜金）**
・11:30 - 13:00

**土日祝日**
・休業

**注意事項：**
・最終注文は12:45まで
・混雑時はお待ちいただく場合があります
・学内行事により営業時間が変更になる場合があります

現在の時刻は{$timeString}です。

他にご質問がございましたらお聞かせください。";
    }

    // 予約に関する質問
    if (strpos($message, '予約') !== false) {
        return "予約についてお答えします。

📝 **予約システム**

**予約可能時間**
・営業時間内（平日11:30-13:00）
・土日は休業日のため予約不可

**予約方法**
1. メインページの「予約」ボタンをクリック
2. 希望日時を選択
3. 人数と連絡先を入力
4. 確認画面で内容を確認
5. 予約完了

**注意事項**
・予約は前日までに完了してください
・キャンセルは前日17:00まで可能
・予約なしでもご利用いただけます（空席がある場合）

予約サイトはメインページからアクセスできます。";
    }

    // アレルギーに関する質問
    if (strpos($message, 'アレルギー') !== false || strpos($message, 'アレルゲン') !== false) {
        return "アレルギー対応についてお答えします。

⚠️ **アレルギー対応**

当食堂では以下のアレルギー対応を行っています：

🌾 **小麦アレルギー対応**
・米粉を使用したメニューを提供
・グルテンフリーの選択肢あり

🥛 **乳製品アレルギー対応**
・豆乳を使用したメニューを提供
・乳製品不使用の選択肢あり

🥚 **卵アレルギー対応**
・卵不使用のメニューを提供
・代替食材を使用した料理あり

🦐 **甲殻類アレルギー対応**
・甲殻類を使用しないメニューを提供

**ご注意：**
・アレルギー対応メニューをご希望の場合は、事前にお申し付けください
・調理器具の共有により、微量のアレルゲンが混入する可能性があります
・重度のアレルギーの方は、医師にご相談の上ご利用ください

詳細については、食堂スタッフまでお気軽にお声かけください。";
    }

    // 料金に関する質問
    if (strpos($message, '料金') !== false || strpos($message, '値段') !== false || strpos($message, '価格') !== false || strpos($message, 'いくら') !== false) {
        return "料金についてお答えします。

💰 **料金表**

🍽️ **定食**
・基本定食：350円
・特選定食：450円
・季節限定定食：500円

🍜 **麺類**
・ラーメン：300円
・うどん：250円
・そば：250円

🍚 **丼物**
・親子丼：400円
・カツ丼：450円
・天丼：500円

🥤 **飲み物**
・コーヒー：100円
・紅茶：100円
・ジュース：120円

**お支払い方法：**
・現金
・学食カード
・電子マネー（一部対応）

詳細については、食堂スタッフまでお気軽にお声かけください。";
    }

    // 場所に関する質問
    if (strpos($message, '場所') !== false || strpos($message, 'どこ') !== false || strpos($message, '位置') !== false || strpos($message, 'アクセス') !== false) {
        return "食堂の場所についてお答えします。

📍 **食堂の場所**

🏢 **建物：** 学生食堂棟 1階
🚪 **入口：** 正門から徒歩3分
🅿️ **駐車場：** 学内駐車場利用可能

**アクセス方法：**
1. 正門から入る
2. メイン通りを直進
3. 学生食堂棟の看板を確認
4. 1階の食堂入口からお入りください

**営業時間：**
・平日：11:30-13:00
・土日祝：休業

**お問い合わせ：**
・電話：012-345-6789
・メール：cafeteria@school.ac.jp

迷われた場合は、学内の案内板をご確認いただくか、スタッフまでお声かけください。";
    }

    // 挨拶
    if (strpos($message, 'こんにちは') !== false || strpos($message, 'こんばんは') !== false || strpos($message, 'おはよう') !== false || strpos($message, 'hello') !== false || strpos($message, 'hi') !== false) {
        return "こんにちは！食堂のAIアシスタントです。

何かお手伝いできることがございましたら、お気軽にお声かけください。

🍽️ メニューについて
⏰ 営業時間について  
📝 予約について
⚠️ アレルギー対応について
💰 料金について
📍 場所について

どのようなご質問でもお受けいたします！";
    }

    // お礼
    if (strpos($message, 'ありがとう') !== false || strpos($message, 'thank') !== false || strpos($message, 'thanks') !== false) {
        return "どういたしまして！

他にもご質問がございましたら、いつでもお声かけください。

食堂について何でもお答えいたします！";
    }

    // 一般的な質問への応答
    if (strpos($message, 'こんにちは') !== false || strpos($message, 'こんばんは') !== false || strpos($message, 'おはよう') !== false || strpos($message, 'hello') !== false || strpos($message, 'hi') !== false) {
        return "こんにちは！食堂のAIアシスタントです。

何かお手伝いできることがございましたら、お気軽にお声かけください。

🍽️ メニューについて
⏰ 営業時間について  
📝 予約について
⚠️ アレルギー対応について
💰 料金について
📍 場所について

どのようなご質問でもお受けいたします！";
    }

    // お礼
    if (strpos($message, 'ありがとう') !== false || strpos($message, 'thank') !== false || strpos($message, 'thanks') !== false) {
        return "どういたしまして！

他にもご質問がございましたら、いつでもお声かけください。

食堂について何でもお答えいたします！";
    }

    // 数学や計算に関する質問
    if (strpos($message, '計算') !== false || strpos($message, '算数') !== false || strpos($message, '数学') !== false || strpos($message, '足し算') !== false || strpos($message, '引き算') !== false || strpos($message, '掛け算') !== false || strpos($message, '割り算') !== false) {
        return "計算のお手伝いをいたします！

基本的な四則演算（足し算、引き算、掛け算、割り算）についてお答えできます。

例：
- 2 + 3 = 5
- 10 - 4 = 6
- 3 × 4 = 12
- 15 ÷ 3 = 5

具体的な計算問題をお聞かせください。";
    }

    // デフォルトの応答（より親切に）
    return "申し訳ございませんが、その質問にはお答えできません。

食堂について以下の内容でしたらお答えできます：

🍽️ メニューについて
⏰ 営業時間について  
📝 予約について
⚠️ アレルギー対応について
💰 料金について
📍 場所について

また、一般的な挨拶や計算のお手伝いもできます。

具体的なご質問をお聞かせください。";
}
?>
