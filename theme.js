// =====================================================
// アプリの色を変えるしくみ（ボタンの色と背景の色を、別々に選べる）
// （<head> の中で読みこむので、ほかのファイルの部品は使わずに、これだけで動くように作る）
// =====================================================

// ブラウザに保存するときの名前
const THEME_KEY = 'timeTracker_theme';

// 色の組み合わせの見本
//   main ＝ ボタンの色（タブ・リンクなどもこの色）
//   bg   ＝ 背景の色
// 見本を足したいときは、ここに足せばOK
const THEMES = [
    { id: 'green', name: 'グリーン', main: '#6b8e7f', bg: '#f7f4ef' },
    { id: 'brown', name: 'ブラウン', main: '#7a5c52', bg: '#f8f1ee' },
    { id: 'pink', name: 'ピンク', main: '#c0707f', bg: '#fbf3f4' },
    { id: 'blue', name: 'ブルー', main: '#5b84b1', bg: '#f2f5f9' },
    { id: 'purple', name: 'パープル', main: '#8e7cc3', bg: '#f5f3fa' }
];

// 背景がこい色のときに使う線の色
const DEFAULT_LINE = '#e5e0d8';

// 色の正しい形（「#」＋ 0〜9・a〜f が6文字。例：#6b8e7f）
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// 色の形が正しいか
function isColor(value) {
    return typeof value === 'string' && COLOR_PATTERN.test(value);
}

// ----- 保存した色を読みこむ（おかしなデータなら、グリーンにする：安全のため） -----
// 形：{ main: '#6b8e7f', bg: '#f7f4ef' }
function loadTheme() {
    try {
        const saved = JSON.parse(localStorage.getItem(THEME_KEY));
        if (saved !== null && typeof saved === 'object') {
            // 今の形
            if (isColor(saved.main) && isColor(saved.bg)) {
                return { main: saved.main.toLowerCase(), bg: saved.bg.toLowerCase() };
            }
            // 前のバージョンの形（{ id: 'brown' } や { id: 'custom', main: '#…' }）も読めるようにする
            const preset = THEMES.find(function (theme) {
                return theme.id === saved.id;
            });
            if (preset) {
                return { main: preset.main, bg: preset.bg };
            }
            if (saved.id === 'custom' && isColor(saved.main)) {
                return { main: saved.main.toLowerCase(), bg: THEMES[0].bg };
            }
        }
    } catch (error) {
        // 読みこめなくても、アプリは止めない
    }
    return { main: THEMES[0].main, bg: THEMES[0].bg };
}

// ----- 色を保存する -----
function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    } catch (error) {
        // 保存できなくても、アプリは止めない
    }
}

// ----- こい色かどうか（文字が読みにくくなる色かどうか） -----
// 「#7a5c52」を赤・緑・青の強さに分けて、明るさを計算する
function isDarkColor(hex) {
    const red = parseInt(hex.slice(1, 3), 16);   // 16進数の文字を数字にする（00〜ff → 0〜255）
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    // 人の目に見える明るさ（緑がいちばん明るく見える）
    const brightness = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
    return brightness < 0.5;
}

// ----- ページに色をぬる -----
// doc ＝ 色をぬるページ（アプリのページ、または浮かせたタイマーのまど）
// CSS の「--main」などの色の名前に、新しい色を入れなおす
function applyThemeTo(doc) {
    const root = doc.documentElement; // <html> タグ
    const dark = isDarkColor(currentTheme.bg);

    root.style.setProperty('--main', currentTheme.main);
    root.style.setProperty('--bg', currentTheme.bg);
    // 線の色：明るい背景なら、背景を少しこくした色。こい背景なら、いつものうすい線
    // color-mix ＝ 2つの色をまぜる（背景92%＋黒8%）
    root.style.setProperty('--line', dark ? DEFAULT_LINE : 'color-mix(in srgb, ' + currentTheme.bg + ' 92%, #000000)');
    // こい背景のときは目じるしのクラスを付ける（CSSで文字の下に白い板をしく）
    root.classList.toggle('is-dark-bg', dark);
}

// 今の色
let currentTheme = loadTheme();

// 画面が出る前に、すぐ色をぬる
applyThemeTo(document);

// =====================================================
// 設定の画面（⚙）の「カラー」のところ
// DOMContentLoaded ＝ HTMLを全部読みこみ終わったときに動く
// （このファイルは <head> で読みこむので、まだ下のHTMLができていないため、終わるのを待つ）
// =====================================================
document.addEventListener('DOMContentLoaded', function () {
    const themeList = document.getElementById('theme-list'); // 見本をならべるところ
    const themeMain = document.getElementById('theme-main'); // ボタンの色を選ぶ入力欄
    const themeBg = document.getElementById('theme-bg');     // 背景の色を選ぶ入力欄

    // 色を変える
    function setTheme(theme) {
        currentTheme = theme;
        saveTheme(theme);
        applyThemeTo(document);
        // 丸いタイマーを浮かせていたら、そちらの色も変える（pip.js があるときだけ）
        if (typeof pipWindow !== 'undefined' && pipWindow) {
            applyThemeTo(pipWindow.document);
        }
        // 色を選ぶ入力欄も、今の色にそろえる
        themeMain.value = theme.main;
        themeBg.value = theme.bg;
        renderThemeList();
    }

    // 見本のボタンを作る
    function renderThemeList() {
        themeList.textContent = ''; // いったん中身を空にする

        THEMES.forEach(function (theme) {
            // 今の色が、この見本とまったく同じなら「選んでいる」
            const selected = currentTheme.main === theme.main && currentTheme.bg === theme.bg;

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'theme-swatch';
            button.setAttribute('role', 'radio');                  // 読み上げソフト用：「1つだけ選べるもの」
            button.setAttribute('aria-checked', String(selected)); // 選んでいるかどうか

            // 色の丸（上半分がボタンの色、下半分が背景の色）
            const circle = document.createElement('span');
            circle.className = 'theme-circle';
            circle.style.background = 'linear-gradient(' + theme.main + ' 50%, ' + theme.bg + ' 50%)';
            button.appendChild(circle);

            // 名前
            const name = document.createElement('span');
            name.textContent = theme.name;
            button.appendChild(name);

            // 押したら、ボタンと背景をセットで変える
            button.addEventListener('click', function () {
                setTheme({ main: theme.main, bg: theme.bg });
            });

            themeList.appendChild(button);
        });
    }

    // ボタンの色を選んでいるとき（色を動かすたびに、すぐ変える）
    themeMain.addEventListener('input', function () {
        if (isColor(themeMain.value)) {
            setTheme({ main: themeMain.value.toLowerCase(), bg: currentTheme.bg });
        }
    });

    // 背景の色を選んでいるとき
    themeBg.addEventListener('input', function () {
        if (isColor(themeBg.value)) {
            setTheme({ main: currentTheme.main, bg: themeBg.value.toLowerCase() });
        }
    });

    // 最初の表示
    themeMain.value = currentTheme.main;
    themeBg.value = currentTheme.bg;
    renderThemeList();
});