// =====================================================
// 背景に画像を使うしくみ
// 画像は大きいので、localStorage ではなく「IndexedDB」という、
// ブラウザの中の大きなものをしまえる保存場所に入れる（どこにも送られない）
// （loadData・saveData は script.js のものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const bgImageInput = document.getElementById('bg-image-input');   // 画像を選ぶ入力欄
const bgImageRemove = document.getElementById('bg-image-remove'); // 「画像をはずす」ボタン
const bgVeil = document.getElementById('bg-veil');                // 画像のうすさのつまみ
const bgVeilLabel = document.getElementById('bg-veil-label');     // つまみのかたまり
const bgImageStatus = document.getElementById('bg-image-status'); // お知らせ

// ----- 決まった値 -----
const BG_DB_NAME = 'timeTrackerImages'; // 画像の保存場所の名前
const BG_STORE = 'images';              // その中の棚の名前
const BG_IMAGE_ID = 'background';       // 背景の画像の名札
const BG_VEIL_KEY = 'timeTracker_bgVeil'; // うすさを保存するときの名前（localStorage）
const BG_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']; // 使える画像の種類
const BG_MAX_SIZE = 10 * 1024 * 1024;   // 画像の大きさの上限（10MB）

// 今出している画像の一時的なURL（はずすときに消すため）
let bgImageUrl = null;

// =====================================================
// 画像の保存場所（IndexedDB）を使うための関数
// Promise ＝ 「終わったら教えてね」というしくみ（.then で、終わったあとのことを書ける）
// =====================================================

// 保存場所を開く（なければ作る）
function openImageDb() {
    return new Promise(function (resolve, reject) {
        const request = indexedDB.open(BG_DB_NAME, 1);
        // はじめて開いたときだけ、棚を作る
        request.onupgradeneeded = function () {
            request.result.createObjectStore(BG_STORE);
        };
        request.onsuccess = function () {
            resolve(request.result);
        };
        request.onerror = function () {
            reject(request.error);
        };
    });
}

// 棚に対して何かする（mode：'readonly' ＝ 読むだけ、'readwrite' ＝ 書きこみもする）
function useImageStore(mode, action) {
    return openImageDb().then(function (db) {
        return new Promise(function (resolve, reject) {
            const transaction = db.transaction(BG_STORE, mode);
            const request = action(transaction.objectStore(BG_STORE));
            transaction.oncomplete = function () {
                db.close();
                resolve(request.result);
            };
            transaction.onerror = function () {
                db.close();
                reject(transaction.error);
            };
        });
    });
}

// =====================================================
// 背景に出す・はずす
// =====================================================

// 保存してある「うすさ」を取り出す（おかしな値なら30にする）
function loadVeil() {
    const value = Number(loadData(BG_VEIL_KEY, 30));
    return Number.isFinite(value) && value >= 0 && value <= 80 ? value : 30;
}

// 画像（と、うすさ）を背景にぬる
function paintBgImage() {
    if (!bgImageUrl) return;
    // 画像の上に、白いうすい膜を重ねる（うすさ 30 なら、白を30%重ねる）
    const veil = Number(bgVeil.value) / 100;
    const veilColor = 'rgba(255, 255, 255, ' + veil + ')';
    document.body.style.backgroundImage =
        'linear-gradient(' + veilColor + ', ' + veilColor + '), url("' + bgImageUrl + '")';
    document.body.classList.add('has-bg-image');
}

// 画像を出す（blob が null なら、はずす）
// blob ＝ 画像ファイルの中身のかたまり
function showBgImage(blob) {
    // 前の一時的なURLがあれば消す（メモリをむだに使わないため）
    if (bgImageUrl) {
        URL.revokeObjectURL(bgImageUrl);
        bgImageUrl = null;
    }

    if (!blob) {
        // はずす
        document.body.style.backgroundImage = '';
        document.body.classList.remove('has-bg-image');
        bgImageRemove.hidden = true;
        bgVeilLabel.hidden = true;
        return;
    }

    // 画像のかたまりを、一時的なURL（blob:〜）にして背景に使う
    bgImageUrl = URL.createObjectURL(blob);
    paintBgImage();
    bgImageRemove.hidden = false;
    bgVeilLabel.hidden = false;
}

// 正しい画像かチェックする（種類と大きさ）
function isValidBgImage(blob) {
    return blob instanceof Blob &&
        BG_ALLOWED_TYPES.includes(blob.type) &&
        blob.size <= BG_MAX_SIZE;
}

// =====================================================
// ボタンやつまみを動かしたとき
// =====================================================

// 画像を選んだとき
bgImageInput.addEventListener('change', function () {
    const file = bgImageInput.files[0];
    bgImageInput.value = ''; // 同じ画像をもう一度選べるように、選んだものを空にもどす
    if (!file) return;

    if (!BG_ALLOWED_TYPES.includes(file.type)) {
        bgImageStatus.textContent = 'png・jpg・webp・gif の画像を選んでください';
        return;
    }
    if (file.size > BG_MAX_SIZE) {
        bgImageStatus.textContent = '画像が大きすぎます（10MBまで）';
        return;
    }

    // 保存場所にしまってから、背景に出す
    useImageStore('readwrite', function (store) {
        return store.put(file, BG_IMAGE_ID);
    }).then(function () {
        showBgImage(file);
        bgImageStatus.textContent = '背景の画像を設定しました';
    }).catch(function () {
        bgImageStatus.textContent = '画像を保存できませんでした';
    });
});

// 「画像をはずす」を押したとき
bgImageRemove.addEventListener('click', function () {
    useImageStore('readwrite', function (store) {
        return store.delete(BG_IMAGE_ID);
    }).then(function () {
        showBgImage(null);
        bgImageStatus.textContent = '背景の画像をはずしました';
    }).catch(function () {
        bgImageStatus.textContent = '画像をはずせませんでした';
    });
});

// うすさのつまみを動かしたとき（動かすたびに、すぐ変える）
bgVeil.addEventListener('input', function () {
    saveData(BG_VEIL_KEY, Number(bgVeil.value));
    paintBgImage();
});

// =====================================================
// ページを開いたときに最初に動くところ
// =====================================================
bgVeil.value = loadVeil();

// 保存してある画像があれば、背景に出す
useImageStore('readonly', function (store) {
    return store.get(BG_IMAGE_ID);
}).then(function (blob) {
    if (blob && isValidBgImage(blob)) {
        showBgImage(blob);
    }
}).catch(function () {
    // 読みこめなくても、アプリは止めない
});