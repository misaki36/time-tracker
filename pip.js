// =====================================================
// 丸いタイマーを、画面の上に浮かせるしくみ
// （Chrome の「Document Picture-in-Picture」という機能を使う）
// （running・siteSelect・taskSelect・startStopBtn・breakBtn・formatTime・
//   getRunningBreakTime・cleanName は script.js のものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const pipOpenBtn = document.getElementById('pip-open-btn'); // 「タイマーを画面に浮かせる」ボタン
const pipNote = document.getElementById('pip-note');       // 説明の文字

// 浮かせるまどの、最初の大きさ（あとからドラッグで変えられる）
const PIP_SIZE = { width: 260, height: 300 };

// 浮かせたまど（開いていないときは null）
let pipWindow = null;

// 浮かせたまどの中の部品（開いていないときは null）
let pipParts = null;

// ----- このブラウザで使えるかどうか -----
function isPipSupported() {
    return 'documentPictureInPicture' in window;
}

if (!isPipSupported()) {
    pipOpenBtn.disabled = true;
    pipNote.textContent = 'このブラウザでは使えません（パソコンの Chrome で使えます）';
}

// =====================================================
// 浮かせたまどの中身を作る
// （doc ＝ 浮かせたまどのページ）
// =====================================================
function buildPipContent(doc) {
    doc.title = 'タイマー';

    // 見た目のファイル（pip.css）を読みこむ
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('pip.css', location.href).href; // アプリと同じ場所にある pip.css
    doc.head.appendChild(link);

    // アプリと同じ色をぬる（theme.js があるときだけ）
    if (typeof applyThemeTo === 'function') {
        applyThemeTo(doc);
    }

    // 丸いタイマー本体
    const face = doc.createElement('div');
    face.className = 'pip-face';

    // サイト名・工程
    const label = doc.createElement('p');
    label.className = 'pip-label';
    face.appendChild(label);

    // 時間の数字
    const time = doc.createElement('p');
    time.className = 'pip-time';
    face.appendChild(time);

    // 休けいの時間
    const breakText = doc.createElement('p');
    breakText.className = 'pip-break-status';
    face.appendChild(breakText);

    // 丸いボタン2つ
    const buttons = doc.createElement('div');
    buttons.className = 'pip-buttons';

    const mainBtn = doc.createElement('button'); // スタート／ストップ
    mainBtn.type = 'button';
    mainBtn.className = 'pip-btn';
    buttons.appendChild(mainBtn);

    const breakButton = doc.createElement('button'); // 休けい／作業にもどる
    breakButton.type = 'button';
    breakButton.className = 'pip-btn';
    buttons.appendChild(breakButton);

    face.appendChild(buttons);

    // お知らせ
    const message = doc.createElement('p');
    message.className = 'pip-message';
    face.appendChild(message);

    doc.body.appendChild(face);

    // ----- ボタンを押したとき -----
    // アプリのほうのボタンを「押したことにする」（.click()）ので、記録もアプリと同じように入る

    // スタート／ストップ
    mainBtn.addEventListener('click', function () {
        // スタートする前に、アプリのほうでサイト名と工程が入っているか確かめる
        if (!running && (cleanName(siteSelect.value) === '' || cleanName(taskSelect.value) === '')) {
            message.textContent = 'アプリのほうで、サイト名と工程を入れてください';
            return;
        }
        message.textContent = '';
        startStopBtn.click();
        updatePip();
    });

    // 休けい／作業にもどる
    breakButton.addEventListener('click', function () {
        breakBtn.click();
        updatePip();
    });

    return { face: face, label: label, time: time, breakText: breakText, mainBtn: mainBtn, breakButton: breakButton };
}

// =====================================================
// 浮かせたまどの表示を、今の状態に合わせる
// =====================================================

// ボタンの見た目を変える（文字・説明・色のクラス）
function setPipButton(button, text, labelText, className) {
    button.textContent = text;
    button.title = labelText;                     // マウスをのせたときに出る説明
    button.setAttribute('aria-label', labelText); // 読み上げソフト用の説明
    button.className = 'pip-btn ' + className;
}

function updatePip() {
    if (!pipParts) return; // まどが開いていなければ何もしない
    const p = pipParts;

    if (running) {
        // ----- はかっている途中 -----
        const now = Date.now();
        p.label.textContent = running.site + '・' + running.task;
        p.time.textContent = formatTime(now - running.startTime - getRunningBreakTime(now));
        setPipButton(p.mainBtn, '■', 'ストップ', 'pip-stop');
        p.breakButton.hidden = false;

        if (running.breakStart) {
            // 休けい中
            p.face.classList.add('is-break');
            p.breakText.textContent = '休けい中 ' + formatTime(now - running.breakStart);
            setPipButton(p.breakButton, '▶', '作業にもどる', 'pip-resume');
        } else {
            // 作業中
            p.face.classList.remove('is-break');
            p.breakText.textContent = '';
            setPipButton(p.breakButton, '☕', '休けい', 'pip-break');
        }
    } else {
        // ----- はかっていないとき -----
        const site = cleanName(siteSelect.value);
        const task = cleanName(taskSelect.value);
        p.label.textContent = site !== '' ? site + (task !== '' ? '・' + task : '') : 'サイト名を入れてね';
        p.time.textContent = '00:00:00';
        p.face.classList.remove('is-break');
        p.breakText.textContent = '';
        setPipButton(p.mainBtn, '▶', 'スタート', 'pip-start');
        p.breakButton.hidden = true; // はかっていないときは休けいボタンをかくす
    }
}

// =====================================================
// 「タイマーを画面に浮かせる」ボタンを押したとき
// （async ＝ 「まどが開くのを待つ」ことができる関数。await のところで、開くまで待つ）
// =====================================================
pipOpenBtn.addEventListener('click', async function () {
    if (!isPipSupported() || pipWindow) return; // 使えない・もう開いているときは何もしない

    try {
        // 浮かせるまどを開く
        pipWindow = await documentPictureInPicture.requestWindow(PIP_SIZE);
    } catch (error) {
        pipNote.textContent = 'タイマーを開けませんでした。もう一度ためしてください。';
        return;
    }

    pipParts = buildPipContent(pipWindow.document);
    updatePip();

    // 0.5秒ごとに表示を更新する
    // （まどのほうのタイマーを使うので、アプリのタブがうしろにあっても、ちゃんと動き続ける）
    pipWindow.setInterval(updatePip, 500);

    pipOpenBtn.textContent = '⏱ タイマーは画面に出ています';
    pipOpenBtn.disabled = true;
    pipNote.textContent = 'まどの上のほうをドラッグすると、好きな場所に動かせます';

    // まどが閉じられたとき：元にもどす
    pipWindow.addEventListener('pagehide', function () {
        pipWindow = null;
        pipParts = null;
        pipOpenBtn.textContent = '⏱ タイマーを画面に浮かせる';
        pipOpenBtn.disabled = false;
        pipNote.textContent = '';
    });
});