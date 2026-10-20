// =====================================================
// ブラウザのタブに、はかっている時間を出すしくみ
// （running・getRunningBreakTime・formatTime は script.js で用意したものを使う）
// =====================================================

// もとのタブの名前（「作業時間きろく」）を覚えておく
const APP_TITLE = document.title;

// タブの名前を更新する
function updateTabTitle() {
    // はかっていないときは、もとの名前にもどす
    if (!running) {
        document.title = APP_TITLE;
        return;
    }

    const now = Date.now();
    // 作業時間 ＝ いま − 始めた時刻 − 休けいの時間
    const workTime = now - running.startTime - getRunningBreakTime(now);
    // 休けい中かどうかで、先頭のマークを変える
    let mark = running.breakStart ? '☕ 休けい中 ' : '▶ ';
    // ストップ忘れのお知らせが出ているときは「⚠」を付ける（reminder.js があるときだけ）
    if (typeof isReminderShown === 'function' && isReminderShown()) {
        mark = '⚠ ' + mark;
    }

    // 例：「▶ 00:12:34｜ポートフォリオ」
    document.title = mark + formatTime(workTime) + '｜' + running.site;
}

// 最初に1回、そのあと1秒ごとに更新する
updateTabTitle();
setInterval(updateTabTitle, 1000);