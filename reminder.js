// =====================================================
// ストップ忘れのお知らせのしくみ
// （running・stop・saveData・loadData・getRunningBreakTime・formatTime は script.js、
//   openEditDialog は edit.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const reminderBox = document.getElementById('reminder-box');                   // お知らせの箱
const reminderText = document.getElementById('reminder-text');                 // お知らせの文字
const reminderContinueBtn = document.getElementById('reminder-continue-btn');  // 「まだ作業中」
const reminderFixBtn = document.getElementById('reminder-fix-btn');            // 「ストップして時刻を直す」
const reminderStopBtn = document.getElementById('reminder-stop-btn');          // 「ストップする」
const reminderSetting = document.getElementById('reminder-setting');           // 何時間でお知らせするか
const notifyBtn = document.getElementById('notify-btn');                       // 「パソコンの通知でも受け取る」
const notifyStatus = document.getElementById('notify-status');                 // 通知の状態の説明

// ----- 決まった値 -----
const REMINDER_KEY = 'timeTracker_reminderHours';  // ブラウザに保存するときの名前
const REMINDER_CHOICES = ['0', '1', '2', '3', '4']; // 選べる値（0 ＝ お知らせしない）
const REMINDER_ONE_HOUR = 60 * 60 * 1000;           // 1時間
const BREAK_REMIND_TIME = 30 * 60 * 1000;           // 休けいのお知らせまで（30分）
const SNOOZE_WORK_TIME = 60 * 60 * 1000;            // 「まだ作業中」を押したら、次は1時間後
const SNOOZE_BREAK_TIME = 30 * 60 * 1000;           // 休けい中なら、次は30分後

// いま出ているお知らせの種類（'work' ＝ 作業、'break' ＝ 休けい、null ＝ 出ていない）
let reminderType = null;

// 最後にパソコンの通知を出したお知らせ（同じお知らせを何度も通知しないため）
let lastNotifiedKey = '';

// ----- 設定を読みこむ（決まった値以外なら3時間にする：安全のため） -----
const savedReminderHours = loadData(REMINDER_KEY, '3');
reminderSetting.value = REMINDER_CHOICES.includes(savedReminderHours) ? savedReminderHours : '3';

// ----- べんりな関数 -----

// お知らせが出ているかどうか（tab-title.js でも使う）
function isReminderShown() {
    return reminderType !== null;
}

// 0以上の数字ならそのまま、ちがえば null を返す（保存データがおかしくても大丈夫なように）
function safeNumber(value) {
    return Number.isFinite(value) && value >= 0 ? value : null;
}

// いまの作業時間を出す
function getCurrentWorkTime(now) {
    return now - running.startTime - getRunningBreakTime(now);
}

// お知らせをかくす
function hideReminder() {
    reminderType = null;
    reminderBox.hidden = true;
}

// お知らせを出す
function showReminder(type, message, notifyKey) {
    reminderType = type;
    reminderText.textContent = message;
    reminderBox.hidden = false;

    // 新しいお知らせのときだけ、パソコンの通知も出す
    if (lastNotifiedKey !== notifyKey) {
        lastNotifiedKey = notifyKey;
        sendNotification(message);
    }
}

// パソコンの通知を出す
function sendNotification(message) {
    if (!('Notification' in window)) return;           // このブラウザが通知に対応していない
    if (Notification.permission !== 'granted') return; // 通知を使っていいと言われていない
    if (!document.hidden) return;                      // このタブを見ているときは出さない（画面のお知らせで分かるので）
    try {
        new Notification('作業時間きろく', { body: message });
    } catch (error) {
        // 通知が出せなくても、アプリは止めない
    }
}

// =====================================================
// お知らせを出すかどうかチェックする（15秒ごと）
// =====================================================
function checkReminder() {
    // はかっていなければ、お知らせはいらない
    if (!running) {
        hideReminder();
        return;
    }

    const now = Date.now();

    // ----- 休けい中のとき -----
    if (running.breakStart) {
        const breakLength = now - running.breakStart; // 今の休けいの長さ
        // 「まだ作業中」を押していたら、その時間まで待つ。押していなければ30分
        const savedLimit = safeNumber(running.breakRemindAt);
        const limit = savedLimit !== null ? savedLimit : BREAK_REMIND_TIME;

        if (breakLength >= limit) {
            const minutes = Math.floor(breakLength / 60000);
            showReminder(
                'break',
                '休けいが' + minutes + '分になりました。長く席を離れるときは、ストップしましょう。',
                'break-' + running.breakStart + '-' + limit
            );
        } else {
            hideReminder();
        }
        return;
    }

    // 休けいが終わったら、休けいのお知らせの続きはリセットする
    if (running.breakRemindAt !== undefined) {
        delete running.breakRemindAt;
        saveData(RUNNING_KEY, running);
    }

    // ----- 作業中のとき -----
    const hours = Number(reminderSetting.value);
    if (hours === 0) {
        hideReminder(); // 「お知らせしない」を選んでいる
        return;
    }

    const workTime = getCurrentWorkTime(now);
    // 「まだ作業中」を押していたら、その時間まで待つ。押していなければ設定の時間
    const savedLimit = safeNumber(running.remindWorkAt);
    const limit = savedLimit !== null ? savedLimit : hours * REMINDER_ONE_HOUR;

    if (workTime >= limit) {
        showReminder(
            'work',
            '作業を始めてから ' + formatTime(workTime) + ' たちました。まだ作業中ですか？',
            'work-' + running.startTime + '-' + limit
        );
    } else {
        hideReminder();
    }
}

// =====================================================
// お知らせのボタン
// =====================================================

// 「まだ作業中」：しばらくたったら、またお知らせする
reminderContinueBtn.addEventListener('click', function () {
    if (!running) {
        hideReminder();
        return;
    }
    const now = Date.now();
    if (reminderType === 'break' && running.breakStart) {
        // 休けい中なら、今の休けいの長さ＋30分で、またお知らせ
        running.breakRemindAt = (now - running.breakStart) + SNOOZE_BREAK_TIME;
    } else {
        // 作業中なら、今の作業時間＋1時間で、またお知らせ
        running.remindWorkAt = getCurrentWorkTime(now) + SNOOZE_WORK_TIME;
    }
    saveData(RUNNING_KEY, running);
    hideReminder();
});

// 「ストップする」
reminderStopBtn.addEventListener('click', function () {
    if (running) {
        stop();
    }
    hideReminder();
});

// 「ストップして時刻を直す」：ストップしたあと、できた記録を直す画面を開く
reminderFixBtn.addEventListener('click', function () {
    if (!running) {
        hideReminder();
        return;
    }
    stop();
    hideReminder();
    openEditDialog(0); // ストップした記録は一覧の一番上（0番目）に入る
});

// =====================================================
// 設定
// =====================================================

// お知らせまでの時間を選びなおしたとき
reminderSetting.addEventListener('change', function () {
    saveData(REMINDER_KEY, reminderSetting.value);
    // はかっている途中なら、「まだ作業中」で決めた時間をリセットして、新しい設定を使う
    if (running) {
        delete running.remindWorkAt;
        saveData(RUNNING_KEY, running);
    }
    checkReminder();
});

// 通知の状態を説明する
function updateNotifyStatus() {
    if (!('Notification' in window)) {
        notifyStatus.textContent = 'このブラウザは通知に対応していません。';
        notifyBtn.hidden = true;
        return;
    }
    if (Notification.permission === 'granted') {
        notifyStatus.textContent = 'パソコンの通知はオンです（別のタブを見ているときに出ます）。';
        notifyBtn.hidden = true;
    } else if (Notification.permission === 'denied') {
        notifyStatus.textContent = '通知がブロックされています。アドレスバーの左のマークから変えられます。';
        notifyBtn.hidden = true;
    } else {
        notifyStatus.textContent = '';
        notifyBtn.hidden = false;
    }
}

// 「パソコンの通知でも受け取る」：通知を使っていいか、ブラウザに聞く
notifyBtn.addEventListener('click', function () {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(updateNotifyStatus);
});

// =====================================================
// チェックするタイミング
// =====================================================

// スタート・ストップ・休けいのボタンを押したら、すぐチェックする
// （script.js のほうが先に動くので、押したあとの状態でチェックできる）
startStopBtn.addEventListener('click', checkReminder);
breakBtn.addEventListener('click', checkReminder);

// ほかのタブからもどってきたときもチェックする
document.addEventListener('visibilitychange', checkReminder);

// ページを開いたときに1回、そのあと15秒ごとにチェックする
updateNotifyStatus();
checkReminder();
setInterval(checkReminder, 15000);