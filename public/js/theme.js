// Theme bootstrap - applies saved theme on every page load
(function(){
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.dataset.theme = saved;
  window.setTheme = function(t){
    localStorage.setItem('theme', t);
    document.documentElement.dataset.theme = t;
  };
  window.toggleTheme = function(){
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    setTheme(cur); return cur;
  };
})();
