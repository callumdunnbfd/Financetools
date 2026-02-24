(() => {
  const y = document.getElementById("footerYear");
  if (y) y.textContent = String(new Date().getFullYear());
})();