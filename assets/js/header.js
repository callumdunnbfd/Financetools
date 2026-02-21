const menus = {
  calculators: [
    ["General",[
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

const panel = document.getElementById("megaPanel");
const content = document.getElementById("megaContent");
const header = document.querySelector(".mega-header");

document.querySelectorAll("[data-menu]").forEach(btn=>{
  btn.addEventListener("mouseenter",()=>{
    const key = btn.dataset.menu;
    buildMenu(key);
    panel.classList.add("open");
  });
});

header.addEventListener("mouseleave", () => panel.classList.remove("open"));

function buildMenu(key){
  content.innerHTML="";
  menus[key].forEach(group=>{
    const col=document.createElement("div");
    col.className="mega-col";
    col.innerHTML=`<h4>${group[0]}</h4>`;
    group[1].forEach(link=>{
      const a=document.createElement("a");
      a.href=link[1];
      a.textContent=link[0];
      col.appendChild(a);
    });
    content.appendChild(col);
  });
}

// mobile
document.getElementById("megaOpen").onclick=()=>{
  document.getElementById("megaMobile").classList.add("open");
};
document.getElementById("megaClose").onclick=()=>{
  document.getElementById("megaMobile").classList.remove("open");
};