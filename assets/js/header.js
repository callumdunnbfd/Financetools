(() => {
  const menus = {
    calculators: [
      ["General", [
        ["Salary calculator","/tools/tools/salary-pay.html"],
        ["Mortgage calculator","/tools/tools/mortgage-calculator.html"],
        ["Percentage calculator","/tools/tools/percentage.html"],
        ["Multi number sum","/tools/tools/number-sum.html"],
        ["VAT & profit","/tools/tools/vat-profit.html"]
      ]]
    ],

    finance: [
      ["Money tools",[
        ["Salary calculator","/tools/tools/salary-pay.html"],
        ["VAT & profit","/tools/tools/vat-profit.html"]
      ]]
    ],

    property: [
      ["Property tools",[
        ["Mortgage calculator","/tools/tools/mortgage-calculator.html"]
      ]]
    ]
  };

  function initMegaHeader() {
    const header = document.querySelector(".mega-header");
    if (!header) return false;
    if (header.dataset.megaBound === "1") return true;
    header.dataset.megaBound = "1";

    const panel = header.querySelector("#megaPanel");
    const content = header.querySelector("#megaContent");
    const openBtn = header.querySelector("#megaOpen");
    const closeBtn = header.querySelector("#megaClose");
    const mobile = header.querySelector("#megaMobile");

    if (!panel || !content) return true;

    const menuButtons = Array.from(header.querySelectorAll("[data-menu]"));

    function setActive(btn){
      menuButtons.forEach(b => b.classList.toggle("is-active", b === btn));
    }

    function clearActive(){
      menuButtons.forEach(b => b.classList.remove("is-active"));
    }

    function buildMenu(key){
      const groups = menus[key];
      if (!groups) return;

      content.innerHTML="";
      groups.forEach(group=>{
        const col=document.createElement("div");
        col.className="mega-col";

        const h=document.createElement("h4");
        h.textContent=group[0];
        col.appendChild(h);

        group[1].forEach(link=>{
          const a=document.createElement("a");
          a.href=link[1];
          a.textContent=link[0];
          col.appendChild(a);
        });

        content.appendChild(col);
      });
    }

    menuButtons.forEach(btn=>{
      const open = () => {
        buildMenu(btn.dataset.menu);
        panel.classList.add("open");
        setActive(btn);
      };

      btn.addEventListener("mouseenter", open);
      btn.addEventListener("focus", open);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      });
    });

    header.addEventListener("mouseleave", () => {
      panel.classList.remove("open");
      clearActive();
    });

    document.addEventListener("click", (e) => {
      if (!header.contains(e.target)) {
        panel.classList.remove("open");
        clearActive();
      }
    });

    if (openBtn && mobile) {
      openBtn.addEventListener("click", () => mobile.classList.add("open"));
    }
    if (closeBtn && mobile) {
      closeBtn.addEventListener("click", () => mobile.classList.remove("open"));
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        panel.classList.remove("open");
        clearActive();
        if (mobile) mobile.classList.remove("open");
      }
    });

    return true;
  }

  if (initMegaHeader()) return;

  const obs = new MutationObserver(() => {
    if (initMegaHeader()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();