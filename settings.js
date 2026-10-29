// =====================================================
// ⚙ 設定の画面を開く・閉じるしくみ
// （中の「ストップ忘れのお知らせ」の設定は reminder.js が動かす）
// =====================================================
const settingsBtn = document.getElementById('settings-btn');             // ⚙ボタン
const settingsDialog = document.getElementById('settings-dialog');       // 設定の画面
const settingsCloseBtn = document.getElementById('settings-close-btn');  // 「閉じる」ボタン

// ⚙を押したら開く
settingsBtn.addEventListener('click', function () {
    settingsDialog.showModal();
});

// 「閉じる」を押したら閉じる（esc キーでも閉じられます）
settingsCloseBtn.addEventListener('click', function () {
    settingsDialog.close();
});