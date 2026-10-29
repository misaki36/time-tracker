// =====================================================
// 画面のタブを切りかえるしくみ
// （loadData・saveData は script.js、renderCharts は charts.js のものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
// querySelectorAll ＝ そのクラスが付いているものを全部さがす
// Array.from ＝ 見つけたものを、ふつうの配列にする（forEach などを使えるように）
const tabButtons = Array.from(document.querySelectorAll('.tab-btn')); // タブのボタン
const tabPanels = Array.from(document.querySelectorAll('.tab-panel')); // タブの中身

// ブラウザに保存するときの名前（最後に開いていたタブを覚えておく）
const TAB_KEY = 'timeTracker_tab';

// ----- タブを切りかえる -----
// panelId ＝ 出したい中身の id（例：'panel-record'）
function showTab(panelId) {
    // 決まった中身の id でなければ、一番左のタブにする（保存データがおかしくても大丈夫なように）
    const exists = tabPanels.some(function (panel) {
        return panel.id === panelId;
    });
    if (!exists) {
        panelId = tabPanels[0].id;
    }

    // ボタンの見た目を変える
    tabButtons.forEach(function (button) {
        const selected = button.getAttribute('aria-controls') === panelId;
        button.classList.toggle('is-active', selected);           // 選んでいるタブに線を出す
        button.setAttribute('aria-selected', String(selected));   // 読み上げソフト用：「選ばれています」
        button.tabIndex = selected ? 0 : -1;                      // Tabキーで移動するのは、選んでいるタブだけにする
    });

    // 中身を出す・かくす
    tabPanels.forEach(function (panel) {
        panel.hidden = panel.id !== panelId;
    });

    // 最後に開いたタブを覚えておく（次に開いたときも同じタブになるように）
    saveData(TAB_KEY, panelId);

    // 「集計・グラフ」を開いたときは、グラフを作り直す
    // （かくれている間に作ったグラフは、大きさがうまく決まらないことがあるため）
    if (panelId === 'panel-stats' && typeof renderCharts === 'function') {
        renderCharts();
    }
}

// ----- タブのボタンを押したとき -----
tabButtons.forEach(function (button) {
    button.addEventListener('click', function () {
        showTab(button.getAttribute('aria-controls'));
    });
});

// ----- キーボードの ← → でもタブを切りかえられるようにする -----
document.querySelector('.tab-bar').addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

    const currentIndex = tabButtons.findIndex(function (button) {
        return button.classList.contains('is-active');
    });
    // → なら右へ、← なら左へ（はしまで行ったら反対のはしにもどる）
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + step + tabButtons.length) % tabButtons.length;

    showTab(tabButtons[nextIndex].getAttribute('aria-controls'));
    tabButtons[nextIndex].focus();
});

// ----- 「#◯◯」へのリンクを押したとき、行き先が別のタブにあれば、そのタブに切りかえる -----
// （例：「言葉がわからないときは『用語集』へ」→ 用語集のタブを開く）
document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href^="#"]'); // 押したものが「#」で始まるリンクか
    if (!link) return;

    const targetId = link.getAttribute('href').slice(1); // 「#glossary」→「glossary」
    const target = document.getElementById(targetId);
    if (!target) return;

    const panel = target.closest('.tab-panel'); // 行き先が入っているタブの中身
    if (panel && panel.hidden) {
        event.preventDefault(); // ふつうのリンクの動きを止める
        showTab(panel.id);
        target.scrollIntoView({ behavior: 'smooth' }); // 行き先までなめらかに動く
    }
});

// ----- ページを開いたときに最初に動くところ -----
// 最後に開いていたタブを出す（なければ「記録する」）
const savedTab = loadData(TAB_KEY, 'panel-record');
showTab(typeof savedTab === 'string' ? savedTab : 'panel-record');