# GmailからLINEへのメール転送設定ガイド（グループ送信版）

## 概要

特定のメールアドレス宛に届いたGmailを、自動的にLINEグループに転送するシステムの構築手順です。

**使用技術:**
- Gmail
- Google Apps Script
- LINE Messaging API（グループチャット）

**特徴:**
- グループチャットに送信するため、複数人で共有可能
- 月200通の制限をフル活用（個別送信だと2人で実質100通）
- グループ内で会話可能（「これ見た？」など）
- Flex Message形式で見やすく表示

**重要:** LINE Notifyは2025年3月31日にサービス終了のため、LINE Messaging APIを使用します。

---

## 前提条件と制約

### LINE Messaging APIの制約
1. **LINE公式アカウントが必要** - 自分で公式アカウントを作成
2. **友だち追加が必要** - Botを友だち追加してグループに招待
3. **グループIDの取得が必要** - 一度グループでメッセージを送る必要がある
4. **メッセージ制限** - 無料プランでは月200通までのプッシュメッセージ

### 料金プラン（2023年6月改定、2025年現在）

LINE公式アカウントには3つの料金プランがあります：

| プラン名 | 月額料金 | 無料メッセージ数 | 追加配信 |
|---------|---------|----------------|---------|
| **コミュニケーションプラン** | 0円 | 200通 | 不可 |
| **ライトプラン** | 5,000円 | 5,000通 | 不可 |
| **スタンダードプラン** | 15,000円 | 30,000通 | 可能（従量課金） |

**ポイント:**
- 無料プラン（コミュニケーションプラン）でも**月200通まで配信可能**
- グループ送信なら1通/メールなので、月200件のメールまで対応可能
- メール転送程度の利用なら無料プランで十分

---

## ファイル構成

このプロジェクトは、3つのGoogle Apps Scriptファイルで構成されています：

### Config.gs
設定ファイル。チャネルアクセストークン、グループID、監視対象メールアドレスなどを設定します。

### Webhook.gs
グループID取得用のスクリプト。セットアップ時のみ使用します。グループでBotにメッセージを送ると、グループIDが返信されます。

**重要:** グループの場合、reply（返信）ではなくpush（プッシュ）メッセージを使用する必要があります。これにより、個人チャットではなくグループ内に応答が届きます。

### EmailForward.gs
メール転送のメインロジック。Gmailから特定のメールを検索し、LINEグループにFlex Message形式で送信します。

---

## セットアップ手順

### 1. LINE公式アカウントを作成

**重要:** 2025年より、LINE Developersから直接Messaging APIチャネルを作成できなくなりました。先にLINE公式アカウントを作成し、その後Messaging APIを有効化する必要があります。

#### 方法1: LINE公式アカウント作成ページから（推奨）

1. https://entry.line.biz/start/jp/ にアクセス
2. 「LINEアカウントで登録」をクリック
3. LINEアカウントでログイン
4. 必要事項を入力：
   - アカウント名：例「メール転送Bot」
   - 業種：適当に選択
   - 大業種・小業種：適当に選択
5. 利用規約に同意して「作成」
6. LINE Official Account Managerが開きます

#### 方法2: LINE Developersから（2025年以降の方法）

1. https://developers.line.biz/console/ にアクセス
2. LINEアカウントでログイン
3. 「プロバイダー」を作成（例：「個人用」）
4. 「Create a Messaging API channel」ボタンをクリック
5. 「Create a LINE Official Account」ボタンをクリック
6. LINE公式アカウント作成ページに移動するので、上記の方法1と同じ手順で作成

---

### 2. Messaging APIを有効化

1. LINE Official Account Manager (https://manager.line.biz/) にアクセス
2. 作成したアカウントを選択
3. 右上の「設定」をクリック
4. 左メニューから「Messaging API」を選択
5. 「Messaging APIを利用する」ボタンをクリック
6. プロバイダーを選択（または新規作成）して「OK」

これで自動的にLINE DevelopersにMessaging APIチャネルが作成されます。

---

### 3. チャネルアクセストークンを取得

#### LINE Official Account Managerで取得する場合

1. LINE Official Account Managerの「Messaging API」設定画面で下にスクロール
2. 「チャネルアクセストークン（長期）」セクションを探す
3. 「発行」ボタンをクリック（未発行の場合）
4. トークンをコピーして保存（**このトークンは大切に保管**）

#### LINE Developers Consoleで取得する場合

1. https://developers.line.biz/console/ にアクセス
2. 作成したプロバイダーとチャネルを選択
3. 「Messaging API設定」タブに移動
4. 下にスクロールして「チャネルアクセストークン（長期）」セクションを探す
5. 「発行」ボタンをクリック
6. トークンをコピーして保存（**このトークンは大切に保管**）

#### 重要な設定も確認

**LINE Official Account Managerで:**
1. 「応答設定」→「詳細設定」
   - 「応答メッセージ」→ オフにする（自動応答を防ぐため）
   - 「Webhook」→ オン（グループID取得時のみ必要、取得後はオフでOK）
2. 「あいさつメッセージ」→ お好みで設定

**LINE Developers Consoleで:**
1. 「Messaging API設定」タブ
2. 「Allow bot to join group chats」→ **オンにする**（必須！）

---

### 4. Google Apps Scriptプロジェクトを作成

1. https://script.google.com/ にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を設定（例：「Gmail to LINE」）

#### 3つのファイルを作成

デフォルトの `Code.gs` を削除し、以下の3つのファイルを作成します：

1. **Config.gs**: 「+」→「スクリプト」から作成
   - このリポジトリの `Config.gs` の内容をコピペ
   - `CHANNEL_ACCESS_TOKEN` を設定（Step 3で取得したトークン）
   - `LINE_GROUP_ID` は後で設定（Step 6で取得）
   - `TARGET_EMAIL` を監視したいメールアドレスに設定

2. **Webhook.gs**: 「+」→「スクリプト」から作成
   - このリポジトリの `Webhook.gs` の内容をコピペ
   - 変更不要（グループID取得用）

3. **EmailForward.gs**: 「+」→「スクリプト」から作成
   - このリポジトリの `EmailForward.gs` の内容をコピペ
   - 変更不要（Config.gsの設定を参照）

---

### 5. Webhookをデプロイ（グループID取得用）

1. Google Apps Scriptエディタで「デプロイ」→「新しいデプロイ」
2. 種類の選択（歯車アイコン）→「ウェブアプリ」
3. 設定：
   - 説明：例「LINE Webhook」
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**（必須！）
4. 「デプロイ」をクリック
5. **ウェブアプリのURL**をコピー（形式：`https://script.google.com/macros/s/.../exec`）
6. 「完了」をクリック

#### Webhook URLを設定

1. LINE Developers console (https://developers.line.biz/console/) の「Messaging API設定」タブを開く
2. 「Webhook URL」に上記URLを貼り付け
3. 「更新」ボタンをクリック
4. 「Webhookの利用」をオンにする
5. 「検証」ボタンをクリック → **「Success」と表示されればOK**

**302エラーが出る場合:**
- デプロイ設定で「アクセスできるユーザー」が「全員」になっているか再確認
- 「デプロイを管理」から新しいバージョンでデプロイし直す

---

### 6. グループIDを取得

#### Step 1: Botを友だち追加

1. LINE Official Account ManagerまたはLINE Developers consoleの「Messaging API設定」タブで**QRコード**を確認
2. LINEアプリでQRコードをスキャンして友だち追加

#### Step 2: LINEグループを作成してBotを追加

1. LINEアプリでグループを作成（共有したいメンバーを追加、例：夫婦）
2. グループにBotを追加（「招待」からBotを検索して追加）

#### Step 3: グループでメッセージを送信

1. グループ内で何でもいいのでメッセージを送信（例：「テスト」）
2. **グループ内に**Botからグループ IDが返信されます
   - 正しく設定されていれば、個人チャットではなくグループに届きます
   - 形式：`Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
3. グループIDをコピーして保存

**個人チャットに届く場合:**
- Webhook.gsが正しく設定されているか確認
- プッシュメッセージ機能が実装されているか確認

---

### 7. Config.gsで設定

Google Apps Scriptに戻り、`Config.gs` を開いて以下を設定：

```javascript
// LINE Messaging API設定
const CHANNEL_ACCESS_TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN_HERE'; // Step 3で取得

// 送信先設定
const SEND_TO_TYPE = 'group';
const LINE_GROUP_ID = 'Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Step 6で取得したグループID

// メール監視設定
const TARGET_EMAIL = 'joe.yshr380+line@gmail.com'; // 監視するメールアドレス（エイリアス可）
const SEARCH_TYPE = 'to'; // 受信先で検索（'from'に変更すれば送信者で検索）
const LABEL_NAME = 'ProcessedForLINE'; // 処理済みラベル
```

**保存**を忘れずに！

---

### 8. テスト実行

1. Google Apps Scriptエディタで `testForward` 関数を選択
2. 「実行」ボタンをクリック
3. 権限の承認を求められたら承認
4. 対象メールが存在する場合、LINEグループに通知が届くか確認

**テスト用メールを送信:**
- `joe.yshr380+line@gmail.com` 宛にテストメールを送信
- 数秒後に `testForward` を実行
- グループに通知が届けばOK

---

### 9. トリガーを設定して自動実行

1. Google Apps Scriptエディタで左側の「トリガー」（時計アイコン）をクリック
2. 右下の「トリガーを追加」をクリック
3. 以下のように設定：
   - 実行する関数: `forwardEmailToLine`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガーのタイプ: `分ベースのタイマー`
   - 時間の間隔: `5分おき` または `10分おき`
4. 「保存」をクリック

---

### 10. Webhookを無効化（オプション）

グループIDを取得したら、Webhookは不要です：

1. LINE Developers Consoleの「Messaging API設定」タブ
2. 「Webhookの利用」をオフに

メール転送にはWebhookは不要で、プッシュメッセージのみ使用します。

---

## 仕様

- **Flex Message形式**で見やすく整形されたメッセージがLINEグループに届きます
- 処理済みメールには `ProcessedForLINE` ラベルが付きます（重複通知を防止）
- 未読メールのみが対象
- メール本文は最初の300文字を表示（Flex Message内）
- グループ送信なので、1通/メールで月200件まで対応可能

---

## カスタマイズ例

### 検索条件の変更

#### 特定の送信者からのメールのみ転送

`Config.gs` を以下のように変更：

```javascript
const TARGET_EMAIL = 'important-sender@example.com'; // 送信者のメールアドレス
const SEARCH_TYPE = 'from'; // 送信者で検索
```

#### 複数のメールアドレスを監視（送信者）

`EmailForward.gs` の `forwardEmailToLine` 関数内のクエリを変更：

```javascript
const TARGET_EMAILS = ['email1@example.com', 'email2@example.com'];
const query = `from:(${TARGET_EMAILS.join(' OR ')}) is:unread -label:${LABEL_NAME}`;
```

#### 複数のエイリアス宛のメールを監視（受信先）

```javascript
const RECIPIENT_EMAILS = ['your-email+work@gmail.com', 'your-email+personal@gmail.com'];
const query = `to:(${RECIPIENT_EMAILS.join(' OR ')}) is:unread -label:${LABEL_NAME}`;
```

#### 件名に特定のキーワードを含むメールのみ転送

```javascript
const query = `to:${TARGET_EMAIL} subject:重要 is:unread -label:${LABEL_NAME}`;
```

---

### メール本文の表示文字数を変更

`EmailForward.gs` の `sendLinePushMessage` 関数内の以下の部分を変更：

```javascript
// 現在（300文字）
'text': body.substring(0, 300) + (body.length > 300 ? '...' : ''),

// 500文字に変更する場合
'text': body.substring(0, 500) + (body.length > 500 ? '...' : ''),
```

---

### Flex Messageの色やレイアウトをカスタマイズ

`EmailForward.gs` の `sendLinePushMessage` 関数内の以下の部分を変更：

```javascript
// ヘッダーの背景色を変更（デフォルト: #1DB446 緑色）
'backgroundColor': '#FF6B6B' // 赤色に変更

// ヘッダーテキストの絵文字を変更
'text': '🎓 学校からのメール', // 学校メールの場合

// 件名の色を変更
'color': '#FF6B6B' // 赤色に変更
```

参考: [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/) でデザインを試せます

---

### シンプルなテキストメッセージに変更

Flex Messageではなく、シンプルなテキストメッセージに変更したい場合は、`EmailForward.gs` の `sendLinePushMessage` 関数を以下のように変更：

```javascript
function sendLinePushMessage(userId, subject, from, date, body) {
  const url = 'https://api.line.me/v2/bot/message/push';

  // 空文字列チェック
  const safeSubject = subject || '(件名なし)';
  const safeFrom = from || '(送信者不明)';
  const safeBody = body || '(本文なし)';

  // シンプルなテキストメッセージ
  const messageText = `【新着メール】\n差出人: ${safeFrom}\n件名: ${safeSubject}\n日時: ${date}\n\n本文:\n${safeBody.substring(0, 500)}${safeBody.length > 500 ? '...(以下省略)' : ''}`;

  const payload = {
    'to': userId,
    'messages': [{
      'type': 'text',
      'text': messageText
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
```

---

## トラブルシューティング

### 通知が届かない場合

1. **Google Apps Scriptの実行ログを確認**
   - エディタ左側の「実行数」からログを確認
   - エラーメッセージがあれば内容を確認

2. **トークンが正しいか確認**
   - `CHANNEL_ACCESS_TOKEN` が正しく設定されているか
   - `LINE_GROUP_ID` が正しく設定されているか（`Cで始まる`）

3. **Gmail APIの権限を確認**
   - スクリプトに必要な権限が付与されているか

4. **LINE側の設定を確認**
   - Botをグループに追加しているか
   - 「Allow bot to join group chats」がオンになっているか

5. **検索クエリを確認**
   - 実際に該当するメールが存在するか
   - Gmailで直接検索して確認：`to:TARGET_EMAIL is:unread -label:ProcessedForLINE`

### グループIDが個人チャットに届く場合

- `Webhook.gs` がプッシュメッセージを使用しているか確認
- `sendPushMessage` 関数が正しく実装されているか確認
- デプロイを新しいバージョンで再デプロイ

### 400エラー（Bad Request）が出る場合

- メールの件名、差出人、本文が空の場合に発生
- `EmailForward.gs` で空文字列のデフォルト値が設定されているか確認
- ログで実際のエラー内容を確認

### プッシュメッセージ制限を超えた場合

無料プランの月200通を超える場合：
- トリガーの実行間隔を長くする（10分おき、15分おきなど）
- 重要なメールアドレスのみに絞る
- 有料プランへの移行を検討（月5,000円〜）

---

## 参考リンク

- [LINE公式アカウント作成](https://entry.line.biz/start/jp/)
- [LINE Official Account Manager](https://manager.line.biz/)
- [LINE Developers Console](https://developers.line.biz/console/)
- [LINE Messaging API ドキュメント](https://developers.line.biz/ja/docs/messaging-api/)
- [LINE公式アカウント料金プラン](https://www.lycbiz.com/jp/service/line-official-account/plan/)
- [Google Apps Script](https://script.google.com/)
- [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)

---

## 更新履歴

- 2025-11-15: グループ送信のみに焦点を当て、個別送信を削除。コードを外部ファイルに分離
- 2025-11-15: グループID取得時のプッシュメッセージ対応を追加
- 2025-11-15: Flex Messageをデフォルトで組み込み、見やすい通知を実現
- 2025-11-15: 複数人への同時送信方法とファイル分割による管理方法を追加
- 2025-11-15: 送信者（from）と受信先（to）の検索方法を追加、エイリアス対応を明記
- 2025-11-15: Webhook設定のトラブルシューティングを追加（302エラー対策、try-catchブロック追加）
- 2025-11-15: 最新の作成手順に更新（LINE Developersから直接Messaging APIチャネルを作成できなくなった仕様変更に対応）
- 2025-11-15: 初版作成（LINE Notify終了に伴い、LINE Messaging API版を作成）
