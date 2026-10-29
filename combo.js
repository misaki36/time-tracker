// =====================================================
// 入力欄＋▾リストのしくみ（サイト名と工程の両方で使う）
// ・自由に入力できる
// ・▾ で今まで入れたものを出す／入力中は合うものだけ出す
// ・× でリストから消す（記録は消えない）
// （saveData・cleanName・createElement・renderAll・startStopBtn は script.js のものを使う）
// =====================================================

// 入力欄＋▾リストを1つ用意する関数
// settings の中身：
//   wrapper  … かたまり全体
//   input    … 入力欄
//   button   … ▾ボタン
//   list     … リスト（ul）
//   getNames … 今まで入れたもののリストをわたす関数
//   saveKey  … ブラウザに保存するときの名前
//   label    … 「サイト名」「工程」などの名前（お知らせの文字に使う）
function setupCombo(settings) {
    const wrapper = settings.wrapper;
    const input = settings.input;
    const button = settings.button;
    const list = settings.list;

    // いま、リストをしぼっている言葉（'' ＝ しぼらずに全部出す）
    let filterText = '';

    // ----- リストを開く・閉じる -----
    function open(text) {
        filterText = text;
        render();
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true'); // 読み上げソフト用：「開いています」
    }

    function close() {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
    }

    // ----- リストの中身を作る -----
    function render() {
        list.textContent = ''; // いったん中身を空にする

        // 入力中の言葉が入っているものだけにしぼる（大文字・小文字は気にしない）
        const keyword = filterText.trim().toLowerCase();
        const names = settings.getNames().filter(function (name) {
            return keyword === '' || name.toLowerCase().includes(keyword);
        });

        if (names.length === 0) {
            const message = keyword === ''
                ? 'まだ入れた' + settings.label + 'はありません'
                : '合う' + settings.label + 'はありません（このまま新しく使えます）';
            list.appendChild(createElement('li', 'combo-empty', message));
            return;
        }

        names.forEach(function (name) {
            const li = createElement('li', 'combo-item');
            li.setAttribute('role', 'option');

            // 名前（押すと入力欄に入る）
            const pickBtn = createElement('button', 'combo-option', name);
            pickBtn.type = 'button';
            pickBtn.addEventListener('click', function () {
                input.value = name;
                close();
                input.focus();
                // 「入力が変わったよ」と知らせる（工程の自動・用語集のひとこと説明などが動くように）
                input.dispatchEvent(new Event('change'));
            });
            li.appendChild(pickBtn);

            // 右の×（押すと、その名前をリストから消す。記録は消えない）
            const deleteBtn = createElement('button', 'combo-delete', '×');
            deleteBtn.type = 'button';
            deleteBtn.setAttribute('aria-label', name + 'をリストから消す');
            deleteBtn.addEventListener('click', function (event) {
                // 下の「リストの外を押したら閉じる」が動かないようにする（続けて消せるように）
                event.stopPropagation();
                removeName(name);
            });
            li.appendChild(deleteBtn);

            list.appendChild(li);
        });
    }

    // ----- 名前をリストから消す -----
    function removeName(name) {
        const names = settings.getNames();
        const index = names.indexOf(name);
        if (index === -1) return;

        names.splice(index, 1); // リストから取りのぞく
        saveData(settings.saveKey, names);
        renderAll();            // ToDoなどの選ぶ箱も作り直す
        render();               // リストは開いたまま作り直す
    }

    // ----- 入力が終わったとき：新しい名前ならリストに足す -----
    // （入力欄からほかの場所に移ったときに動く。ToDoなどでも、すぐその名前が選べるようになる）
    input.addEventListener('change', function () {
        const name = cleanName(input.value);
        input.value = name;
        const names = settings.getNames();
        if (name !== '' && !names.includes(name)) {
            names.push(name);
            saveData(settings.saveKey, names);
            renderAll();
        }
    });

    // ▾ボタン：リストを開く・閉じる
    button.addEventListener('click', function () {
        if (input.disabled) return; // はかっている途中は開かない
        if (list.hidden) {
            open(''); // ▾のときは、しぼらずに全部出す
        } else {
            close();
        }
    });

    // 入力しているとき：合うものだけ出す
    input.addEventListener('input', function () {
        open(input.value);
    });

    // esc キーで閉じる
    wrapper.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            close();
        }
    });

    // リストの外を押したら閉じる
    document.addEventListener('click', function (event) {
        if (!wrapper.contains(event.target)) {
            close();
        }
    });

    // はかっている途中は▾ボタンも押せないようにする
    function updateButton() {
        button.disabled = input.disabled;
        if (input.disabled) {
            close();
        }
    }
    startStopBtn.addEventListener('click', updateButton);
    updateButton();
}

// ----- サイト名の入力欄 -----
setupCombo({
    wrapper: document.getElementById('site-combo'),
    input: siteSelect,
    button: document.getElementById('site-history-btn'),
    list: document.getElementById('site-history'),
    getNames: function () { return sites; },
    saveKey: SITES_KEY,
    label: 'サイト名'
});

// ----- 工程の入力欄 -----
setupCombo({
    wrapper: document.getElementById('task-combo'),
    input: taskSelect,
    button: document.getElementById('task-history-btn'),
    list: document.getElementById('task-history'),
    getNames: function () { return tasks; },
    saveKey: TASKS_KEY,
    label: '工程'
});