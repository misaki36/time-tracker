// =====================================================
// ToDoリストのしくみ
// （sites・siteSelect・memoInput・running・start・stop などは script.js で用意したものを使う）
// =====================================================

// ----- 画面の部品をつかまえる -----
const todoForm = document.getElementById('todo-form');           // ToDoを足すフォーム
const todoSite = document.getElementById('todo-site');           // ToDoのサイト名を選ぶ箱
const todoInput = document.getElementById('todo-input');         // やることの入力欄
const todoFilter = document.getElementById('todo-filter');       // 見るサイトをしぼる箱
const todoCount = document.getElementById('todo-count');         // のこりの数
const todoList = document.getElementById('todo-list');           // ToDoの一覧
const todoClearBtn = document.getElementById('todo-clear-btn');  // 「終わったものを消す」ボタン

// ブラウザに保存するときの「名前」
const TODOS_KEY = 'timeTracker_todos';

// やることの文字の長さの上限（メモと同じ100文字）
const MAX_TODO_LENGTH = 100;

// ----- データの形をチェックする（おかしなデータを読みこまないため） -----
function isValidTodo(todo) {
    return todo !== null &&
        typeof todo === 'object' &&
        typeof todo.id === 'string' && todo.id.length <= 40 &&                // 見分けるための名札
        typeof todo.site === 'string' && todo.site.length <= MAX_NAME_LENGTH && // サイト名
        typeof todo.text === 'string' && todo.text.length > 0 &&
        todo.text.length <= MAX_TODO_LENGTH &&                                  // やること
        typeof todo.done === 'boolean' &&                                       // 終わったかどうか
        Number.isFinite(todo.createdAt);                                        // 作った時刻
}

// ----- データを用意する -----
const loadedTodos = loadData(TODOS_KEY, []);
let todos = Array.isArray(loadedTodos) ? loadedTodos.filter(isValidTodo) : [];

// いま「表示」で選んでいるサイト（'' ＝ すべてのサイト）
let todoFilterValue = '';

// ----- べんりな関数 -----

// ToDoを見分けるための名札(id)を作る（時刻＋ランダムな文字で、ほかとかぶらないようにする）
function makeTodoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ToDoを保存する
function saveTodos() {
    saveData(TODOS_KEY, todos);
}

// ----- 選ぶ箱を作り直す -----
function renderTodoSelects() {
    // ToDoを足すときのサイト名
    fillSelect(todoSite, sites);

    // 「表示」の選ぶ箱：設定のサイト名＋（設定から消したけど）ToDoが残っているサイト名
    const names = sites.slice();
    todos.forEach(function (todo) {
        if (!names.includes(todo.site)) {
            names.push(todo.site);
        }
    });

    todoFilter.textContent = '';
    // 一番上は「すべてのサイト」
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'すべてのサイト';
    todoFilter.appendChild(allOption);

    names.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        todoFilter.appendChild(option);
    });

    // 前に選んでいたサイトがまだあれば、そのまま。なければ「すべて」にもどす
    if (todoFilterValue !== '' && !names.includes(todoFilterValue)) {
        todoFilterValue = '';
    }
    todoFilter.value = todoFilterValue;
}

// ----- ToDoの一覧を作り直す -----
function renderTodoList() {
    todoList.textContent = ''; // いったん中身を空にする

    // 「表示」で選んだサイトのものだけにしぼる
    const shown = todos.filter(function (todo) {
        return todoFilterValue === '' || todo.site === todoFilterValue;
    });

    // まだのもの → 終わったもの、の順にならべる
    const notDone = shown.filter(function (todo) { return !todo.done; });
    const done = shown.filter(function (todo) { return todo.done; });
    const sorted = notDone.concat(done);

    todoCount.textContent = 'のこり ' + notDone.length + '件';

    if (sorted.length === 0) {
        todoList.appendChild(createElement('li', 'empty-text', 'ToDoはありません'));
    }

    sorted.forEach(function (todo) {
        const li = createElement('li', 'todo-item');
        if (todo.done) {
            li.classList.add('is-done'); // 終わったものは見た目を変える
        }

        // チェックと文字（label でかこむと、文字を押してもチェックできる）
        const label = createElement('label', 'todo-check');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = todo.done;
        checkbox.addEventListener('change', function () {
            todo.done = checkbox.checked; // 終わった／まだ を切りかえる
            saveTodos();
            renderTodoList();
        });
        label.appendChild(checkbox);
        label.appendChild(createElement('span', 'todo-text', todo.text));
        li.appendChild(label);

        // 「すべてのサイト」で見ているときだけ、サイト名を出す
        if (todoFilterValue === '') {
            li.appendChild(createElement('span', 'todo-site', todo.site));
        }

        // まだのものだけ「▶ はじめる」ボタンを出す
        if (!todo.done) {
            const startBtn = createElement('button', 'todo-start-btn', '▶ はじめる');
            startBtn.type = 'button';
            startBtn.setAttribute('aria-label', todo.text + 'をはじめる'); // 読み上げソフト用の説明
            startBtn.addEventListener('click', function () {
                startTodo(todo);
            });
            li.appendChild(startBtn);
        }

        // 「×」ボタン（このToDoを消す）
        const deleteBtn = createElement('button', 'setting-delete', '×');
        deleteBtn.type = 'button';
        deleteBtn.setAttribute('aria-label', todo.text + 'を消す');
        deleteBtn.addEventListener('click', function () {
            deleteTodo(todo.id);
        });
        li.appendChild(deleteBtn);

        todoList.appendChild(li);
    });

    // 終わったものが1つもなければ「終わったものを消す」ボタンをかくす
    todoClearBtn.hidden = !todos.some(function (todo) { return todo.done; });
}

// ToDoのところを全部作り直す（script.js の renderAll からも呼ばれる）
function renderTodos() {
    renderTodoSelects();
    renderTodoList();
}

// ----- ToDoを1つ消す -----
function deleteTodo(id) {
    if (!confirm('このToDoを消しますか？')) {
        return;
    }
    todos = todos.filter(function (todo) {
        return todo.id !== id; // その名札のもの以外を残す ＝ その1つを消す
    });
    saveTodos();
    renderTodos();
}

// ----- ToDoからスタートする -----
function startTodo(todo) {
    // はかっている途中なら、ストップしていいか聞く
    if (running) {
        if (!confirm('いまの作業をストップして、「' + todo.text + '」を始めますか？')) {
            return;
        }
        stop();
    }

    siteSelect.value = todo.site;  // サイト名の入力欄に入れる
    memoInput.value = todo.text;   // やったことに入れる
    // やったことから工程を自動で決める（auto-task.js があるときだけ）
    if (typeof autoChooseTask === 'function') {
        autoChooseTask();
    }

    // 一番上（タイマーのところ）までスクロールする
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ----- ToDoを足すフォームで「追加」が押されたとき -----
todoForm.addEventListener('submit', function (event) {
    event.preventDefault(); // ページが読みこみ直されないようにする

    const text = todoInput.value.trim(); // 前後の空白を取る
    if (text === '') {
        return; // 空っぽなら何もしない
    }
    if (text.length > MAX_TODO_LENGTH) {
        alert('ToDoは' + MAX_TODO_LENGTH + '文字までにしてください。');
        return;
    }

    if (todoSite.value === '') {
        alert('サイト名がまだありません。「いまの作業」でサイト名を入れてください。');
        return;
    }

    todos.push({
        id: makeTodoId(),
        site: todoSite.value,
        text: text,
        done: false,
        createdAt: Date.now()
    });
    saveTodos();
    todoInput.value = ''; // 入力欄を空にもどす
    renderTodos();
});

// ----- 「表示」でサイトを選びなおしたとき -----
todoFilter.addEventListener('change', function () {
    todoFilterValue = todoFilter.value;
    // サイトを選んだら、ToDoを足すときのサイトもそれに合わせる（べんりなので）
    if (todoFilterValue !== '' && sites.includes(todoFilterValue)) {
        todoSite.value = todoFilterValue;
    }
    renderTodoList();
});

// ----- 「終わったものを消す」が押されたとき -----
todoClearBtn.addEventListener('click', function () {
    if (!confirm('終わったToDoを全部消しますか？')) {
        return;
    }
    todos = todos.filter(function (todo) {
        return !todo.done; // まだのものだけ残す
    });
    saveTodos();
    renderTodos();
});

// ----- ページを開いたときに最初に動くところ -----
renderTodos();