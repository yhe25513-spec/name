/**
 * 墨韵加载动画控制
 * 页面完全加载后淡出加载画面
 */
(function () {
  const loader = document.getElementById('ink-loader');
  if (!loader) return;

  // 最短显示 1.5 秒，最长 3 秒
  const minDisplay = 1500;
  const maxDisplay = 3000;
  const startTime = Date.now();

  function hideLoader() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, minDisplay - elapsed);

    setTimeout(() => {
      loader.classList.add('loaded');
      // 动画结束后移除 DOM
      setTimeout(() => loader.remove(), 600);
    }, remaining);
  }

  // 页面完全加载后执行
  if (document.readyState === 'complete') {
    hideLoader();
  } else {
    window.addEventListener('load', hideLoader);
  }

  // 安全上限：3 秒后强制消失
  setTimeout(() => {
    if (!loader.classList.contains('loaded')) {
      loader.classList.add('loaded');
      setTimeout(() => loader.remove(), 600);
    }
  }, maxDisplay);
})();
