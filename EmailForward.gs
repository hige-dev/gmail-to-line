// ========================================
// メール転送スクリプト
// ========================================
// Gmailから特定のメールを検索し、LINEに転送します
// ========================================

/**
 * メール転送のメイン関数
 * トリガーから定期的に実行されます
 */
function forwardEmailToLine() {
  // ラベルの取得または作成
  let label = GmailApp.getUserLabelByName(LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(LABEL_NAME);
  }

  // メールを検索（fromまたはtoで検索）
  const query = `${SEARCH_TYPE}:${TARGET_EMAIL} is:unread -label:${LABEL_NAME}`;
  const threads = GmailApp.search(query, 0, 10); // 最大10件

  if (threads.length === 0) {
    Logger.log('新しいメールはありません');
    return;
  }

  threads.forEach(thread => {
    const messages = thread.getMessages();

    messages.forEach(message => {
      // メール情報を取得（空の場合はデフォルト値を設定）
      const subject = message.getSubject() || '(件名なし)';
      const from = message.getFrom() || '(送信者不明)';
      const date = Utilities.formatDate(message.getDate(), 'JST', 'yyyy/MM/dd HH:mm');
      const plainBody = message.getPlainBody() || '';
      const body = plainBody.substring(0, 500) || '(本文なし)'; // 最初の500文字

      // 送信先に応じて送信
      if (SEND_TO_TYPE === 'group') {
        // グループに送信
        sendLinePushMessage(LINE_GROUP_ID, subject, from, date, body);
        Logger.log(`転送完了（グループ）: ${subject}`);
      } else {
        // 個人に送信
        LINE_USER_IDS.forEach(userId => {
          sendLinePushMessage(userId, subject, from, date, body);
        });
        Logger.log(`転送完了（個人${LINE_USER_IDS.length}人）: ${subject}`);
      }
    });

    // 処理済みラベルを付ける
    thread.addLabel(label);

    // 受信トレイから削除
    const inboxLabel = GmailApp.getInboxLabel();
    thread.removeLabel(inboxLabel);
  });
}

/**
 * LINEにプッシュメッセージを送信
 * Flex Message形式で見やすく表示
 *
 * @param {string} userId - LINEユーザーID
 * @param {string} subject - メール件名
 * @param {string} from - 送信者
 * @param {string} date - 日時
 * @param {string} body - メール本文
 */
function sendLinePushMessage(userId, subject, from, date, body) {
  const url = 'https://api.line.me/v2/bot/message/push';

  // 空文字列チェック（念のため）
  const safeSubject = subject || '(件名なし)';
  const safeFrom = from || '(送信者不明)';
  const safeBody = body || '(本文なし)';

  const payload = {
    'to': userId,
    'messages': [{
      'type': 'flex',
      'altText': `新着メール: ${safeSubject}`,
      'contents': {
        'type': 'bubble',
        'header': {
          'type': 'box',
          'layout': 'vertical',
          'contents': [{
            'type': 'text',
            'text': '📧 新着メール',
            'weight': 'bold',
            'color': '#FFFFFF',
            'size': 'md'
          }],
          'backgroundColor': '#1DB446'
        },
        'body': {
          'type': 'box',
          'layout': 'vertical',
          'contents': [
            {
              'type': 'text',
              'text': safeSubject,
              'weight': 'bold',
              'size': 'lg',
              'wrap': true,
              'color': '#1A1A1A'
            },
            {
              'type': 'box',
              'layout': 'vertical',
              'margin': 'lg',
              'spacing': 'sm',
              'contents': [
                {
                  'type': 'box',
                  'layout': 'baseline',
                  'spacing': 'sm',
                  'contents': [
                    {
                      'type': 'text',
                      'text': '差出人',
                      'color': '#AAAAAA',
                      'size': 'sm',
                      'flex': 2
                    },
                    {
                      'type': 'text',
                      'text': safeFrom,
                      'wrap': true,
                      'color': '#666666',
                      'size': 'sm',
                      'flex': 5
                    }
                  ]
                },
                {
                  'type': 'box',
                  'layout': 'baseline',
                  'spacing': 'sm',
                  'contents': [
                    {
                      'type': 'text',
                      'text': '日時',
                      'color': '#AAAAAA',
                      'size': 'sm',
                      'flex': 2
                    },
                    {
                      'type': 'text',
                      'text': date,
                      'wrap': true,
                      'color': '#666666',
                      'size': 'sm',
                      'flex': 5
                    }
                  ]
                }
              ]
            },
            {
              'type': 'separator',
              'margin': 'lg'
            },
            {
              'type': 'box',
              'layout': 'vertical',
              'margin': 'lg',
              'contents': [
                {
                  'type': 'text',
                  'text': '本文',
                  'color': '#AAAAAA',
                  'size': 'xs',
                  'margin': 'none'
                },
                {
                  'type': 'text',
                  'text': safeBody.substring(0, 300) + (safeBody.length > 300 ? '...' : ''),
                  'wrap': true,
                  'color': '#666666',
                  'size': 'sm',
                  'margin': 'md'
                }
              ]
            }
          ]
        }
      }
    }]
  };

  const options = {
    'method': 'post',
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
    },
    'payload': JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log(`LINE送信成功 (${userId}): ` + response.getContentText());
  } catch (e) {
    Logger.log(`LINE送信エラー (${userId}): ` + e.toString());
  }
}

/**
 * 手動テスト用関数
 * スクリプトエディタから直接実行して動作確認できます
 */
function testForward() {
  forwardEmailToLine();
}
