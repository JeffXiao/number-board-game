/* 数学十字谜 — i18n module.
   Owns the string tables and the current language. The choice is
   persisted in localStorage (the game's one stored preference) and
   read back before the first render; English is the default. */
(function (global) {
  "use strict";
  const MC = global.MC || (global.MC = {});
  const CONFIG = MC.CONFIG;

  const LANGUAGES = {
    en: {
      title: "Math Crossword", htmlLang: "en", code: "EN", locale: "en-US",
      menuChoose: "Choose a mode",
      menuDaily: "Daily", menuDailyDesc: "One puzzle a day, on the calendar",
      menuMain: "Practice", menuMainDesc: "Play anytime, any difficulty",
      register: "Register", registerTitle: "Register",
      registerLabel: "Player name", registerPlaceholder: "Your name",
      registerSave: "Save", registerCancel: "Cancel",
      registerHint: "Kept on this device only.",
      registerEmpty: "Please enter a name.",
      registerTaken: "That name is already registered. Try a different name.",
      registeredPlayers: "Registered players",
      testsLink: "Unit tests", testsTitle: "Unit tests", testsRun: "Run again",
      testsSummary: function (passed, total) { return passed + " of " + total + " tests passed"; },
      calWeekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      calPrevMonth: "Previous month", calNextMonth: "Next month",
      calBackToMenu: "Back to menu", calBackToCalendar: "Back to calendar",
      calCompletedSuffix: " — completed", calFutureSuffix: " — not available yet",
      calPlayDaily: function (dateText) { return "Play the daily puzzle for " + dateText; },
      mistakes: "Mistakes", time: "Time", hints: "Hints",
      easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert", difficulty: "Difficulty",
      pausedTitle: "Paused", pausedText: "Take a break — continue when you’re ready.", resume: "Resume",
      retry: "Try again", again: "New puzzle", continueBtn: "Continue",
      resetTitle: "Reset this round?", resetText: "Resetting clears the numbers you’ve placed, and mistakes and time start over.", yes: "Yes", no: "No",
      bankTitle: "Number tiles", boardLabel: "Math crossword board", bankLabel: "Number tiles",
      resetLabel: "Reset this round — asks for confirmation first",
      soundOffLabel: "Turn off the placement sound", soundOnLabel: "Turn on the placement sound",
      pauseLabel: "Pause", hintLabel: "Hint: fill in one correct number", hintTitle: "Hint",
      fullscreenLabel: "Full screen", fullscreenExitLabel: "Exit full screen",
      sortLabel: "Sort tiles from smallest to largest", sortRestoreLabel: "Restore the tiles’ original order",
      undoLabel: "Undo last move", langLabel: "Language / 语言",
      emptyCell: "Empty cell", boardFullToast: "The board is full, but some red numbers still don’t match — drag a wrong one back or tap its cell to fix it",
      hintWrong: "Fix the red numbers first, then use a hint", hintStuck: "These placements can’t fit together — change a few numbers and try again",
      mistakeTitle: "So close", mistakeText: "That’s 5 mistakes. Try this puzzle again, or start a new one.",
      winTitle: "All correct!",
      solutionLabel: "Your completed answer", solutionBoardLabel: "Completed answer",
      progress: function (done, total) { return "Filled " + done + " / " + total; },
      filledCell: function (value) { return "Filled " + value + " — tap to take it back, or drag it back to the tiles"; },
      tileLabel: function (value) { return "Number tile " + value; },
      mismatch: function (text) { return "Doesn’t add up: " + text + " isn’t true — drag it back or tap the cell to fix it"; },
      winText: function (time, mistakes, hints) {
        return "Time " + time + ", " + mistakes + " mistake" + (mistakes === 1 ? "" : "s") +
          (hints ? ", " + hints + " hint" + (hints === 1 ? "" : "s") + " used" : "") + ". Play another?";
      }
    },
    zh: {
      title: "数学十字谜", htmlLang: "zh-CN", code: "中文", locale: "zh-CN",
      menuChoose: "选择模式",
      menuDaily: "每日", menuDailyDesc: "每天一题，在日历上玩",
      menuMain: "练习", menuMainDesc: "随时玩，任意难度",
      register: "注册", registerTitle: "注册",
      registerLabel: "玩家名字", registerPlaceholder: "你的名字",
      registerSave: "保存", registerCancel: "取消",
      registerHint: "仅保存在本设备上。",
      registerEmpty: "请输入名字。",
      registerTaken: "这个名字已经注册过了，换一个名字试试。",
      registeredPlayers: "已注册玩家",
      testsLink: "单元测试", testsTitle: "单元测试", testsRun: "重新运行",
      testsSummary: function (passed, total) { return total + " 个测试通过了 " + passed + " 个"; },
      calWeekdays: ["日", "一", "二", "三", "四", "五", "六"],
      calPrevMonth: "上个月", calNextMonth: "下个月",
      calBackToMenu: "返回菜单", calBackToCalendar: "返回日历",
      calCompletedSuffix: " — 已完成", calFutureSuffix: " — 尚未开放",
      calPlayDaily: function (dateText) { return "打开" + dateText + "的每日题目"; },
      mistakes: "错误", time: "用时", hints: "提示",
      easy: "简单", medium: "中等", hard: "困难", expert: "专家", difficulty: "难度",
      pausedTitle: "已暂停", pausedText: "休息一下，准备好了再继续。", resume: "继续游戏",
      retry: "再试一次", again: "换一题", continueBtn: "继续",
      resetTitle: "真的要重置吗？", resetText: "重置会清空这一局已经填好的数字，错误次数和用时也会重新开始。", yes: "是", no: "否",
      bankTitle: "数字牌", boardLabel: "数学十字谜棋盘", bankLabel: "数字牌",
      resetLabel: "重置本局，会先弹出确认",
      soundOffLabel: "关闭放入数字的声音", soundOnLabel: "打开放入数字的声音",
      pauseLabel: "暂停", hintLabel: "提示：填入一个正确数字", hintTitle: "提示",
      fullscreenLabel: "全屏", fullscreenExitLabel: "退出全屏",
      sortLabel: "把数字牌从小到大排序", sortRestoreLabel: "恢复数字牌原来的顺序",
      undoLabel: "返回上一步", langLabel: "语言 / Language",
      emptyCell: "空格", boardFullToast: "棋盘填满了，但还有标红的数字对不上，把错的拖回或点格子改一改",
      hintWrong: "先把标红的数字改对，再用提示", hintStuck: "现在的填法凑不到一起，先改几个数字再试",
      mistakeTitle: "差一点点", mistakeText: "错误满 5 次了。可以再试一次这一题，或者换一题新的。",
      winTitle: "全部填对了！",
      solutionLabel: "你刚才完成的答案", solutionBoardLabel: "完成的答案",
      progress: function (done, total) { return "已填 " + done + " / " + total; },
      filledCell: function (value) { return "已填 " + value + "，点按取回，或拖回数字牌"; },
      tileLabel: function (value) { return "数字牌 " + value; },
      mismatch: function (text) { return "数字对不上：" + text + " 不成立，拖回或点格子改"; },
      winText: function (time, mistakes, hints) {
        return "用时 " + time + "，错误 " + mistakes + " 次" + (hints ? "，用了 " + hints + " 次提示" : "") + "。再来一题？";
      }
    }
  };

  function readStoredLanguage() {
    try {
      let saved = global.localStorage.getItem(CONFIG.LANG_STORAGE_KEY);
      return LANGUAGES[saved] ? saved : CONFIG.DEFAULT_LANG;
    } catch (error) { return CONFIG.DEFAULT_LANG; }
  }
  function persistLanguage(code) {
    try { global.localStorage.setItem(CONFIG.LANG_STORAGE_KEY, code); } catch (error) { /* storage unavailable: language just won't stick */ }
  }

  let currentLanguage = readStoredLanguage();

  MC.i18n = Object.freeze({
    translate: function (keyName) { return LANGUAGES[currentLanguage][keyName]; },
    language: function () { return currentLanguage; },
    hasLanguage: function (code) { return !!LANGUAGES[code]; },
    setLanguage: function (code) {
      if (!LANGUAGES[code]) return false;
      currentLanguage = code;
      persistLanguage(code);
      return true;
    }
  });
})(window);
